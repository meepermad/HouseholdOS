-- Phase 3: confirm / reject / cancel / reverse / waiver / dispute RPCs

create or replace function public.confirm_payment(p_payment_id uuid)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_membership uuid;
  v_corr uuid := gen_random_uuid();
  v_alloc record;
  v_outstanding integer;
  v_sender_user uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  perform set_config('householdos.payment_mutation', 'rpc', true);

  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment not found';
  end if;

  if not public.is_active_member(v_payment.household_id) then
    raise exception 'Not an active member of this household';
  end if;

  v_membership := public.current_membership_id(v_payment.household_id);
  if v_membership is distinct from v_payment.recipient_membership_id then
    raise exception 'Unauthorized confirmation';
  end if;

  if v_payment.status = 'confirmed' then
    return v_payment;
  end if;
  if v_payment.status <> 'submitted' then
    raise exception 'Payment already %', v_payment.status;
  end if;

  for v_alloc in
    select *
    from public.payment_allocations
    where payment_id = p_payment_id
    order by obligation_id
  loop
    perform 1 from public.reimbursement_obligations o
    where o.id = v_alloc.obligation_id
    for update;

    v_outstanding := public._official_outstanding_cents(v_alloc.obligation_id);
    if v_alloc.amount_cents > v_outstanding then
      raise exception 'Confirmation conflict: obligation changed since review';
    end if;
  end loop;

  update public.payments
  set status = 'confirmed',
      confirmed_at = now(),
      confirmed_by_membership_id = v_membership,
      updated_at = now()
  where id = p_payment_id
  returning * into v_payment;

  for v_alloc in
    select * from public.payment_allocations where payment_id = p_payment_id
  loop
    perform public._sync_obligation_settlement_status(v_alloc.obligation_id);
  end loop;

  perform public._payment_audit(
    v_payment.household_id, 'payment', p_payment_id, 'payment.confirmed',
    jsonb_build_object('status', 'submitted'),
    jsonb_build_object('status', 'confirmed'),
    null, v_corr
  );

  v_sender_user := public._membership_user_id(v_payment.sender_membership_id);
  perform public._emit_notification_event(
    v_payment.household_id,
    'payment.confirmed',
    'payment',
    p_payment_id,
    v_membership,
    jsonb_build_object(
      'payment_id', p_payment_id,
      'total_amount_cents', v_payment.total_amount_cents
    ),
    'payment.confirmed:' || p_payment_id::text,
    array[v_sender_user],
    'Payment confirmed received',
    'Your recorded payment was confirmed by the recipient.',
    '/app/' || v_payment.household_id::text || '/money/payments/' || p_payment_id::text
  );

  return v_payment;
end;
$$;

revoke all on function public.confirm_payment(uuid) from public;
grant execute on function public.confirm_payment(uuid) to authenticated;

create or replace function public.reject_payment(
  p_payment_id uuid,
  p_reason text
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_membership uuid;
  v_sender_user uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 1 then
    raise exception 'Rejection reason required';
  end if;

  perform set_config('householdos.payment_mutation', 'rpc', true);

  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment not found';
  end if;

  v_membership := public.current_membership_id(v_payment.household_id);
  if v_membership is distinct from v_payment.recipient_membership_id then
    raise exception 'Unauthorized confirmation';
  end if;

  if v_payment.status = 'rejected' then
    return v_payment;
  end if;
  if v_payment.status <> 'submitted' then
    raise exception 'Payment already %', v_payment.status;
  end if;

  update public.payments
  set status = 'rejected',
      rejected_at = now(),
      rejected_by_membership_id = v_membership,
      rejection_reason = trim(p_reason),
      updated_at = now()
  where id = p_payment_id
  returning * into v_payment;

  perform public._payment_audit(
    v_payment.household_id, 'payment', p_payment_id, 'payment.rejected',
    jsonb_build_object('status', 'submitted'),
    jsonb_build_object('status', 'rejected', 'reason', trim(p_reason)),
    p_reason, null
  );

  v_sender_user := public._membership_user_id(v_payment.sender_membership_id);
  perform public._emit_notification_event(
    v_payment.household_id,
    'payment.rejected',
    'payment',
    p_payment_id,
    v_membership,
    jsonb_build_object('payment_id', p_payment_id, 'reason', trim(p_reason)),
    'payment.rejected:' || p_payment_id::text,
    array[v_sender_user],
    'Payment rejected',
    'The recipient rejected your recorded payment. You can submit a corrected payment.',
    '/app/' || v_payment.household_id::text || '/money/payments/' || p_payment_id::text
  );

  return v_payment;
end;
$$;

revoke all on function public.reject_payment(uuid, text) from public;
grant execute on function public.reject_payment(uuid, text) to authenticated;

create or replace function public.cancel_payment(p_payment_id uuid)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_membership uuid;
  v_recipient_user uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  perform set_config('householdos.payment_mutation', 'rpc', true);

  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment not found';
  end if;

  v_membership := public.current_membership_id(v_payment.household_id);
  if v_membership is distinct from v_payment.sender_membership_id then
    raise exception 'Only the sender may cancel a submitted payment';
  end if;

  if v_payment.status = 'cancelled' then
    return v_payment;
  end if;
  if v_payment.status <> 'submitted' then
    raise exception 'Payment already %', v_payment.status;
  end if;

  update public.payments
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by_membership_id = v_membership,
      updated_at = now()
  where id = p_payment_id
  returning * into v_payment;

  perform public._payment_audit(
    v_payment.household_id, 'payment', p_payment_id, 'payment.cancelled',
    jsonb_build_object('status', 'submitted'),
    jsonb_build_object('status', 'cancelled'),
    null, null
  );

  v_recipient_user := public._membership_user_id(v_payment.recipient_membership_id);
  perform public._emit_notification_event(
    v_payment.household_id,
    'payment.cancelled',
    'payment',
    p_payment_id,
    v_membership,
    jsonb_build_object('payment_id', p_payment_id),
    'payment.cancelled:' || p_payment_id::text,
    array[v_recipient_user],
    'Payment cancelled',
    'A submitted payment awaiting your confirmation was cancelled by the sender.',
    '/app/' || v_payment.household_id::text || '/money/payments/' || p_payment_id::text
  );

  return v_payment;
end;
$$;

revoke all on function public.cancel_payment(uuid) from public;
grant execute on function public.cancel_payment(uuid) to authenticated;

create or replace function public.reverse_payment(
  p_payment_id uuid,
  p_reason text
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_membership uuid;
  v_alloc record;
  v_other_user uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 1 then
    raise exception 'Reversal reason required';
  end if;

  perform set_config('householdos.payment_mutation', 'rpc', true);

  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment not found';
  end if;

  v_membership := public.current_membership_id(v_payment.household_id);

  -- Recipient who confirmed may reverse; financial_coordinator via dispute resolution only elsewhere.
  if v_membership is distinct from v_payment.recipient_membership_id
     and v_membership is distinct from v_payment.confirmed_by_membership_id then
    raise exception 'Unauthorized confirmation';
  end if;

  if v_payment.status = 'reversed' then
    raise exception 'Payment already reversed';
  end if;
  if v_payment.status <> 'confirmed' then
    raise exception 'Only confirmed payments can be reversed';
  end if;

  if exists (select 1 from public.payment_reversals where payment_id = p_payment_id) then
    raise exception 'Payment already reversed';
  end if;

  insert into public.payment_reversals (
    payment_id, household_id, reversed_by_membership_id, reason
  ) values (
    p_payment_id, v_payment.household_id, v_membership, trim(p_reason)
  );

  update public.payments
  set status = 'reversed',
      reversed_at = now(),
      updated_at = now()
  where id = p_payment_id
  returning * into v_payment;

  for v_alloc in
    select * from public.payment_allocations
    where payment_id = p_payment_id
    order by obligation_id
  loop
    perform 1 from public.reimbursement_obligations where id = v_alloc.obligation_id for update;
    perform public._sync_obligation_settlement_status(v_alloc.obligation_id);
  end loop;

  perform public._payment_audit(
    v_payment.household_id, 'payment', p_payment_id, 'payment.reversed',
    jsonb_build_object('status', 'confirmed'),
    jsonb_build_object('status', 'reversed'),
    p_reason, null
  );

  v_other_user := public._membership_user_id(v_payment.sender_membership_id);
  perform public._emit_notification_event(
    v_payment.household_id,
    'payment.reversed',
    'payment',
    p_payment_id,
    v_membership,
    jsonb_build_object('payment_id', p_payment_id),
    'payment.reversed:' || p_payment_id::text,
    array[v_other_user],
    'Payment reversed',
    'A previously confirmed payment was reversed. Outstanding balances were reopened.',
    '/app/' || v_payment.household_id::text || '/money/payments/' || p_payment_id::text
  );

  return v_payment;
end;
$$;

revoke all on function public.reverse_payment(uuid, text) from public;
grant execute on function public.reverse_payment(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Waivers
-- ---------------------------------------------------------------------------
create or replace function public.create_reimbursement_waiver(
  p_obligation_id uuid,
  p_amount_cents integer,
  p_reason text
)
returns public.reimbursement_waivers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_obl public.reimbursement_obligations%rowtype;
  v_membership uuid;
  v_outstanding integer;
  v_waiver public.reimbursement_waivers%rowtype;
  v_debtor_user uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 1 then
    raise exception 'Waiver reason required';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'Invalid waiver amount';
  end if;

  perform set_config('householdos.payment_mutation', 'rpc', true);

  select * into v_obl from public.reimbursement_obligations where id = p_obligation_id for update;
  if not found then
    raise exception 'Obligation not found';
  end if;

  v_membership := public.current_membership_id(v_obl.household_id);
  if v_membership is distinct from v_obl.creditor_membership_id then
    raise exception 'Only the creditor may waive an obligation';
  end if;
  if v_membership = v_obl.debtor_membership_id then
    raise exception 'Debtor cannot waive their own obligation';
  end if;
  if v_obl.status = 'reversed' then
    raise exception 'Obligation changed since review';
  end if;

  v_outstanding := public._official_outstanding_cents(p_obligation_id);
  if p_amount_cents > v_outstanding then
    raise exception 'Invalid waiver amount';
  end if;

  insert into public.reimbursement_waivers (
    household_id, obligation_id, amount_cents, reason, created_by_membership_id, status
  ) values (
    v_obl.household_id, p_obligation_id, p_amount_cents, trim(p_reason), v_membership, 'active'
  )
  returning * into v_waiver;

  perform public._sync_obligation_settlement_status(p_obligation_id);

  perform public._payment_audit(
    v_obl.household_id, 'reimbursement_waiver', v_waiver.id, 'reimbursement.waived',
    null,
    jsonb_build_object(
      'obligation_id', p_obligation_id,
      'amount_cents', p_amount_cents
    ),
    p_reason, null
  );

  v_debtor_user := public._membership_user_id(v_obl.debtor_membership_id);
  perform public._emit_notification_event(
    v_obl.household_id,
    'waiver.created',
    'reimbursement_waiver',
    v_waiver.id,
    v_membership,
    jsonb_build_object('waiver_id', v_waiver.id, 'obligation_id', p_obligation_id, 'amount_cents', p_amount_cents),
    'waiver.created:' || v_waiver.id::text,
    array[v_debtor_user],
    'Obligation waived',
    'A creditor waived part or all of an outstanding obligation.',
    '/app/' || v_obl.household_id::text || '/money/reimbursements/' || p_obligation_id::text
  );

  return v_waiver;
end;
$$;

revoke all on function public.create_reimbursement_waiver(uuid, integer, text) from public;
grant execute on function public.create_reimbursement_waiver(uuid, integer, text) to authenticated;

create or replace function public.reverse_reimbursement_waiver(
  p_waiver_id uuid,
  p_reason text
)
returns public.reimbursement_waivers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_waiver public.reimbursement_waivers%rowtype;
  v_membership uuid;
  v_debtor uuid;
  v_debtor_user uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 1 then
    raise exception 'Waiver reversal reason required';
  end if;

  perform set_config('householdos.payment_mutation', 'rpc', true);

  select * into v_waiver from public.reimbursement_waivers where id = p_waiver_id for update;
  if not found then
    raise exception 'Waiver not found';
  end if;
  if v_waiver.status = 'reversed' then
    raise exception 'Waiver already reversed';
  end if;

  v_membership := public.current_membership_id(v_waiver.household_id);
  if v_membership is distinct from v_waiver.created_by_membership_id then
    raise exception 'Only the waiving creditor may reverse this waiver';
  end if;

  insert into public.reimbursement_waiver_reversals (
    waiver_id, household_id, reversed_by_membership_id, reason
  ) values (
    p_waiver_id, v_waiver.household_id, v_membership, trim(p_reason)
  );

  update public.reimbursement_waivers
  set status = 'reversed', updated_at = now()
  where id = p_waiver_id
  returning * into v_waiver;

  perform public._sync_obligation_settlement_status(v_waiver.obligation_id);

  perform public._payment_audit(
    v_waiver.household_id, 'reimbursement_waiver', p_waiver_id, 'waiver.reversed',
    jsonb_build_object('status', 'active'),
    jsonb_build_object('status', 'reversed'),
    p_reason, null
  );

  select debtor_membership_id into v_debtor
  from public.reimbursement_obligations where id = v_waiver.obligation_id;
  v_debtor_user := public._membership_user_id(v_debtor);

  perform public._emit_notification_event(
    v_waiver.household_id,
    'waiver.reversed',
    'reimbursement_waiver',
    p_waiver_id,
    v_membership,
    jsonb_build_object('waiver_id', p_waiver_id, 'obligation_id', v_waiver.obligation_id),
    'waiver.reversed:' || p_waiver_id::text,
    array[v_debtor_user],
    'Waiver reversed',
    'A previous waiver was reversed. Outstanding balances were reopened.',
    '/app/' || v_waiver.household_id::text || '/money/reimbursements/' || v_waiver.obligation_id::text
  );

  return v_waiver;
end;
$$;

revoke all on function public.reverse_reimbursement_waiver(uuid, text) from public;
grant execute on function public.reverse_reimbursement_waiver(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Disputes
-- ---------------------------------------------------------------------------
create or replace function public.open_dispute(
  p_household_id uuid,
  p_dispute_type text,
  p_reason text,
  p_expense_id uuid default null,
  p_obligation_id uuid default null,
  p_payment_id uuid default null
)
returns public.reimbursement_disputes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership uuid;
  v_dispute public.reimbursement_disputes%rowtype;
  v_targets uuid[] := array[]::uuid[];
  v_uid uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 1 then
    raise exception 'Dispute reason required';
  end if;

  perform set_config('householdos.payment_mutation', 'rpc', true);

  if not public.is_active_member(p_household_id) then
    raise exception 'Not an active member of this household';
  end if;
  v_membership := public.current_membership_id(p_household_id);

  if ((p_expense_id is not null)::int + (p_obligation_id is not null)::int + (p_payment_id is not null)::int) <> 1 then
    raise exception 'Dispute must reference exactly one subject';
  end if;

  insert into public.reimbursement_disputes (
    household_id, raised_by_membership_id, dispute_type, reason, status,
    expense_id, obligation_id, payment_id
  ) values (
    p_household_id, v_membership, p_dispute_type, trim(p_reason), 'open',
    p_expense_id, p_obligation_id, p_payment_id
  )
  returning * into v_dispute;

  insert into public.dispute_events (
    dispute_id, household_id, actor_membership_id, event_type, note
  ) values (
    v_dispute.id, p_household_id, v_membership, 'opened', trim(p_reason)
  );

  perform public._payment_audit(
    p_household_id, 'reimbursement_dispute', v_dispute.id, 'dispute.opened',
    null,
    jsonb_build_object(
      'dispute_type', p_dispute_type,
      'expense_id', p_expense_id,
      'obligation_id', p_obligation_id,
      'payment_id', p_payment_id
    ),
    p_reason, null
  );

  -- Notify other active members (no financial effect)
  for v_uid in
    select m.user_id
    from public.household_memberships m
    where m.household_id = p_household_id
      and m.status = 'active'
      and m.user_id is distinct from auth.uid()
  loop
    v_targets := array_append(v_targets, v_uid);
  end loop;

  perform public._emit_notification_event(
    p_household_id,
    'dispute.opened',
    'reimbursement_dispute',
    v_dispute.id,
    v_membership,
    jsonb_build_object('dispute_id', v_dispute.id, 'dispute_type', p_dispute_type),
    'dispute.opened:' || v_dispute.id::text,
    v_targets,
    'Dispute opened',
    'A household member opened a financial dispute.',
    '/app/' || p_household_id::text || '/money/disputes/' || v_dispute.id::text
  );

  return v_dispute;
end;
$$;

revoke all on function public.open_dispute(uuid, text, text, uuid, uuid, uuid) from public;
grant execute on function public.open_dispute(uuid, text, text, uuid, uuid, uuid) to authenticated;

create or replace function public.resolve_dispute(
  p_dispute_id uuid,
  p_resolution_type text,
  p_resolution_note text,
  p_related_corrective_entity_type text default null,
  p_related_corrective_entity_id uuid default null
)
returns public.reimbursement_disputes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dispute public.reimbursement_disputes%rowtype;
  v_membership uuid;
  v_raiser_user uuid;
  v_is_coord boolean;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_resolution_type is null then
    raise exception 'Resolution type required';
  end if;

  perform set_config('householdos.payment_mutation', 'rpc', true);

  select * into v_dispute from public.reimbursement_disputes where id = p_dispute_id for update;
  if not found then
    raise exception 'Dispute not found';
  end if;
  if v_dispute.status in ('resolved', 'withdrawn') then
    raise exception 'Dispute conflict';
  end if;

  v_membership := public.current_membership_id(v_dispute.household_id);
  select exists (
    select 1 from public.household_membership_roles r
    where r.membership_id = v_membership
      and r.role = 'financial_coordinator'
  ) into v_is_coord;

  -- Raiser, involved payment party, or financial coordinator may resolve with note.
  if v_membership is distinct from v_dispute.raised_by_membership_id and not v_is_coord then
    if v_dispute.payment_id is not null then
      if not exists (
        select 1 from public.payments p
        where p.id = v_dispute.payment_id
          and (p.sender_membership_id = v_membership or p.recipient_membership_id = v_membership)
      ) then
        raise exception 'Dispute conflict';
      end if;
    elsif v_dispute.obligation_id is not null then
      if not exists (
        select 1 from public.reimbursement_obligations o
        where o.id = v_dispute.obligation_id
          and (o.debtor_membership_id = v_membership or o.creditor_membership_id = v_membership)
      ) then
        raise exception 'Dispute conflict';
      end if;
    elsif not v_is_coord then
      raise exception 'Dispute conflict';
    end if;
  end if;

  update public.reimbursement_disputes
  set status = 'resolved',
      resolution_type = p_resolution_type,
      resolution_note = nullif(trim(coalesce(p_resolution_note, '')), ''),
      resolved_at = now(),
      resolved_by_membership_id = v_membership,
      related_corrective_entity_type = p_related_corrective_entity_type,
      related_corrective_entity_id = p_related_corrective_entity_id,
      updated_at = now()
  where id = p_dispute_id
  returning * into v_dispute;

  insert into public.dispute_events (
    dispute_id, household_id, actor_membership_id, event_type, note
  ) values (
    p_dispute_id, v_dispute.household_id, v_membership, 'resolved',
    coalesce(p_resolution_note, p_resolution_type)
  );

  perform public._payment_audit(
    v_dispute.household_id, 'reimbursement_dispute', p_dispute_id, 'dispute.resolved',
    jsonb_build_object('status', 'open'),
    jsonb_build_object('status', 'resolved', 'resolution_type', p_resolution_type),
    p_resolution_note, null
  );

  v_raiser_user := public._membership_user_id(v_dispute.raised_by_membership_id);
  perform public._emit_notification_event(
    v_dispute.household_id,
    'dispute.resolved',
    'reimbursement_dispute',
    p_dispute_id,
    v_membership,
    jsonb_build_object('dispute_id', p_dispute_id, 'resolution_type', p_resolution_type),
    'dispute.resolved:' || p_dispute_id::text,
    array[v_raiser_user],
    'Dispute resolved',
    'A financial dispute was resolved.',
    '/app/' || v_dispute.household_id::text || '/money/disputes/' || p_dispute_id::text
  );

  return v_dispute;
end;
$$;

revoke all on function public.resolve_dispute(uuid, text, text, text, uuid) from public;
grant execute on function public.resolve_dispute(uuid, text, text, text, uuid) to authenticated;

create or replace function public.withdraw_dispute(p_dispute_id uuid)
returns public.reimbursement_disputes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dispute public.reimbursement_disputes%rowtype;
  v_membership uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  perform set_config('householdos.payment_mutation', 'rpc', true);

  select * into v_dispute from public.reimbursement_disputes where id = p_dispute_id for update;
  if not found then
    raise exception 'Dispute not found';
  end if;

  v_membership := public.current_membership_id(v_dispute.household_id);
  if v_membership is distinct from v_dispute.raised_by_membership_id then
    raise exception 'Dispute conflict';
  end if;
  if v_dispute.status in ('resolved', 'withdrawn') then
    raise exception 'Dispute conflict';
  end if;

  update public.reimbursement_disputes
  set status = 'withdrawn', updated_at = now()
  where id = p_dispute_id
  returning * into v_dispute;

  insert into public.dispute_events (
    dispute_id, household_id, actor_membership_id, event_type
  ) values (
    p_dispute_id, v_dispute.household_id, v_membership, 'withdrawn'
  );

  perform public._payment_audit(
    v_dispute.household_id, 'reimbursement_dispute', p_dispute_id, 'dispute.withdrawn',
    jsonb_build_object('status', 'open'),
    jsonb_build_object('status', 'withdrawn'),
    null, null
  );

  return v_dispute;
end;
$$;

revoke all on function public.withdraw_dispute(uuid) from public;
grant execute on function public.withdraw_dispute(uuid) to authenticated;
