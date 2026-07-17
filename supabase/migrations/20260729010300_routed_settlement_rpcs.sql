-- Completion-B: routed settlement RPCs (one intermediary A→B→C)

create or replace function public._routed_reserved_cents(p_obligation_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount_cents), 0)::integer
  from public.routed_settlement_reservations
  where obligation_id = p_obligation_id and status = 'active';
$$;

revoke all on function public._routed_reserved_cents(uuid) from public;

create or replace function public._routed_available_cents(
  p_obligation_id uuid,
  p_exclude_proposal_id uuid default null
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    0,
    public._official_outstanding_cents(p_obligation_id)
      - coalesce((
          select sum(r.amount_cents)::integer
          from public.routed_settlement_reservations r
          where r.obligation_id = p_obligation_id
            and r.status = 'active'
            and (p_exclude_proposal_id is null or r.proposal_id <> p_exclude_proposal_id)
        ), 0)
      - coalesce((
          select sum(pa.amount_cents)::integer
          from public.payment_allocations pa
          join public.payments p on p.id = pa.payment_id
          where pa.obligation_id = p_obligation_id
            and p.status = 'submitted'
        ), 0)
  );
$$;

revoke all on function public._routed_available_cents(uuid, uuid) from public;

create or replace function public._mark_routed_stale_if_needed(p_proposal_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.routed_settlement_proposals%rowtype;
  v_ab integer;
  v_bc integer;
  v_snap_ab integer;
  v_snap_bc integer;
begin
  select * into v_p from public.routed_settlement_proposals where id = p_proposal_id for update;
  if not found then return false; end if;
  if v_p.status in ('confirmed','reversed','cancelled','rejected','expired','stale') then
    return v_p.status = 'stale';
  end if;
  if v_p.expires_at is not null and v_p.expires_at < now() then
    update public.routed_settlement_proposals set status = 'expired', updated_at = now() where id = p_proposal_id;
    update public.routed_settlement_reservations set status = 'released', updated_at = now()
    where proposal_id = p_proposal_id and status = 'active';
    insert into public.routed_settlement_events (proposal_id, household_id, event_type, detail)
    values (p_proposal_id, v_p.household_id, 'settlement.route_expired', '{}'::jsonb);
    return true;
  end if;

  v_ab := public._routed_available_cents(v_p.source_obligation_ab_id, p_proposal_id);
  v_bc := public._routed_available_cents(v_p.source_obligation_bc_id, p_proposal_id);
  v_snap_ab := coalesce((v_p.balance_snapshot->>'ab_outstanding_cents')::int, -1);
  v_snap_bc := coalesce((v_p.balance_snapshot->>'bc_outstanding_cents')::int, -1);

  if v_ab < v_p.amount_cents or v_bc < v_p.amount_cents
     or (v_snap_ab >= 0 and v_ab < v_p.amount_cents)
     or (v_snap_bc >= 0 and v_bc < v_p.amount_cents) then
    update public.routed_settlement_proposals set status = 'stale', updated_at = now() where id = p_proposal_id;
    update public.routed_settlement_reservations set status = 'released', updated_at = now()
    where proposal_id = p_proposal_id and status = 'active';
    insert into public.routed_settlement_events (proposal_id, household_id, event_type, detail)
    values (p_proposal_id, v_p.household_id, 'settlement.route_stale',
      jsonb_build_object('ab_available', v_ab, 'bc_available', v_bc));
    return true;
  end if;
  return false;
end;
$$;

revoke all on function public._mark_routed_stale_if_needed(uuid) from public;

create or replace function public.create_routed_settlement_proposal(
  p_household_id uuid,
  p_payer_membership_id uuid,
  p_intermediary_membership_id uuid,
  p_recipient_membership_id uuid,
  p_amount_cents integer,
  p_obligation_ab_id uuid,
  p_obligation_bc_id uuid,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_ab public.reimbursement_obligations%rowtype;
  v_bc public.reimbursement_obligations%rowtype;
  v_ab_out integer;
  v_bc_out integer;
  v_currency text;
  v_id uuid;
  v_max integer;
  v_intermediary_user uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_active_member(p_household_id) then
    raise exception 'Not an active household member';
  end if;
  v_actor := public.current_membership_id(p_household_id);

  if p_idempotency_key is not null then
    select id into v_id from public.routed_settlement_proposals where client_idempotency_key = p_idempotency_key;
    if found then return v_id; end if;
  end if;

  if p_payer_membership_id = p_intermediary_membership_id
     or p_intermediary_membership_id = p_recipient_membership_id
     or p_payer_membership_id = p_recipient_membership_id then
    raise exception 'Payer, intermediary, and recipient must be distinct';
  end if;

  select * into v_ab from public.reimbursement_obligations where id = p_obligation_ab_id for update;
  if not found then raise exception 'A→B obligation not found'; end if;
  select * into v_bc from public.reimbursement_obligations where id = p_obligation_bc_id for update;
  if not found then raise exception 'B→C obligation not found'; end if;

  if v_ab.household_id <> p_household_id or v_bc.household_id <> p_household_id then
    raise exception 'Source obligations not found in household';
  end if;
  if v_ab.debtor_membership_id <> p_payer_membership_id
     or v_ab.creditor_membership_id <> p_intermediary_membership_id then
    raise exception 'A→B obligation parties mismatch';
  end if;
  if v_bc.debtor_membership_id <> p_intermediary_membership_id
     or v_bc.creditor_membership_id <> p_recipient_membership_id then
    raise exception 'B→C obligation parties mismatch';
  end if;
  if v_ab.status in ('reversed','waived') or v_bc.status in ('reversed','waived') then
    raise exception 'Source obligations are not eligible';
  end if;
  if exists (
    select 1 from public.reimbursement_disputes d
    where d.household_id = p_household_id
      and d.status in ('open', 'under_review')
      and (d.obligation_id = p_obligation_ab_id or d.obligation_id = p_obligation_bc_id)
  ) then
    raise exception 'Cannot route disputed obligations';
  end if;

  select coalesce(
    (select e.currency from public.expenses e where e.id = v_ab.expense_id),
    (select h.currency from public.households h where h.id = p_household_id),
    'USD'
  ) into v_currency;

  v_ab_out := public._routed_available_cents(p_obligation_ab_id, null);
  v_bc_out := public._routed_available_cents(p_obligation_bc_id, null);
  v_max := least(v_ab_out, v_bc_out);
  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > v_max then
    raise exception 'Routed amount exceeds available outstanding (max %)', v_max;
  end if;

  insert into public.routed_settlement_proposals (
    household_id, payer_membership_id, intermediary_membership_id, recipient_membership_id,
    amount_cents, currency, source_obligation_ab_id, source_obligation_bc_id,
    balance_snapshot, expires_at, status, client_idempotency_key, created_by_membership_id
  ) values (
    p_household_id, p_payer_membership_id, p_intermediary_membership_id, p_recipient_membership_id,
    p_amount_cents, v_currency, p_obligation_ab_id, p_obligation_bc_id,
    jsonb_build_object(
      'ab_outstanding_cents', v_ab_out,
      'bc_outstanding_cents', v_bc_out,
      'max_routable_cents', v_max
    ),
    now() + interval '7 days',
    'awaiting_intermediary_approval',
    p_idempotency_key,
    v_actor
  ) returning id into v_id;

  insert into public.routed_settlement_legs (proposal_id, household_id, leg_kind, obligation_id, amount_cents)
  values
    (v_id, p_household_id, 'a_to_b', p_obligation_ab_id, p_amount_cents),
    (v_id, p_household_id, 'b_to_c', p_obligation_bc_id, p_amount_cents),
    (v_id, p_household_id, 'a_to_c_external', null, p_amount_cents);

  insert into public.routed_settlement_reservations (proposal_id, household_id, obligation_id, amount_cents)
  values
    (v_id, p_household_id, p_obligation_ab_id, p_amount_cents),
    (v_id, p_household_id, p_obligation_bc_id, p_amount_cents);

  insert into public.routed_settlement_events (proposal_id, household_id, event_type, actor_membership_id, detail)
  values (v_id, p_household_id, 'settlement.route_proposed', v_actor,
    jsonb_build_object('amount_cents', p_amount_cents));

  v_intermediary_user := public._membership_user_id(p_intermediary_membership_id);
  if v_intermediary_user is not null then
    perform public._emit_notification_event(
      p_household_id,
      'settlement.intermediary_approval_required',
      'routed_settlement',
      v_id,
      v_actor,
      jsonb_build_object('source_type', 'routed_settlement', 'source_id', v_id),
      'settlement.intermediary_approval_required:' || v_id::text,
      array[v_intermediary_user],
      'Routed payment needs your approval',
      'A roommate wants to simplify balances through you. Review in the app.',
      '/app/' || p_household_id::text || '/money/simplify/' || v_id::text
    );
  end if;

  return v_id;
end;
$$;

create or replace function public.approve_routed_settlement_intermediary(
  p_proposal_id uuid,
  p_decision text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.routed_settlement_proposals%rowtype;
  v_actor uuid;
  v_recipient_user uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_p from public.routed_settlement_proposals where id = p_proposal_id for update;
  if not found then raise exception 'Proposal not found'; end if;
  v_actor := public.current_membership_id(v_p.household_id);
  if v_actor <> v_p.intermediary_membership_id then
    raise exception 'Only the intermediary may approve';
  end if;
  if public._mark_routed_stale_if_needed(p_proposal_id) then
    raise exception 'Proposal became stale; balances changed';
  end if;
  select * into v_p from public.routed_settlement_proposals where id = p_proposal_id;
  if v_p.status <> 'awaiting_intermediary_approval' then
    raise exception 'Not awaiting intermediary approval';
  end if;

  insert into public.routed_settlement_approvals (proposal_id, household_id, membership_id, role, decision, note)
  values (p_proposal_id, v_p.household_id, v_actor, 'intermediary',
    case when p_decision = 'approved' then 'approved' else 'rejected' end, p_note);

  if p_decision <> 'approved' then
    update public.routed_settlement_proposals set status = 'rejected', updated_at = now() where id = p_proposal_id;
    update public.routed_settlement_reservations set status = 'released', updated_at = now()
    where proposal_id = p_proposal_id and status = 'active';
    insert into public.routed_settlement_events (proposal_id, household_id, event_type, actor_membership_id)
    values (p_proposal_id, v_p.household_id, 'settlement.route_rejected', v_actor);
    return;
  end if;

  update public.routed_settlement_proposals
  set status = 'awaiting_recipient_acceptance', updated_at = now()
  where id = p_proposal_id;

  insert into public.routed_settlement_events (proposal_id, household_id, event_type, actor_membership_id)
  values (p_proposal_id, v_p.household_id, 'settlement.route_intermediary_approved', v_actor);

  v_recipient_user := public._membership_user_id(v_p.recipient_membership_id);
  if v_recipient_user is not null then
    perform public._emit_notification_event(
      v_p.household_id,
      'settlement.recipient_acceptance_required',
      'routed_settlement',
      p_proposal_id,
      v_actor,
      jsonb_build_object('source_type', 'routed_settlement', 'source_id', p_proposal_id),
      'settlement.recipient_acceptance_required:' || p_proposal_id::text,
      array[v_recipient_user],
      'Routed payment needs your acceptance',
      'Accept to receive an external payment that also clears related balances.',
      '/app/' || v_p.household_id::text || '/money/simplify/' || p_proposal_id::text
    );
  end if;
end;
$$;

create or replace function public.accept_routed_settlement_recipient(
  p_proposal_id uuid,
  p_decision text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.routed_settlement_proposals%rowtype;
  v_actor uuid;
  v_payer_user uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_p from public.routed_settlement_proposals where id = p_proposal_id for update;
  if not found then raise exception 'Proposal not found'; end if;
  v_actor := public.current_membership_id(v_p.household_id);
  if v_actor <> v_p.recipient_membership_id then
    raise exception 'Only the recipient may accept';
  end if;
  if public._mark_routed_stale_if_needed(p_proposal_id) then
    raise exception 'Proposal became stale; balances changed';
  end if;
  select * into v_p from public.routed_settlement_proposals where id = p_proposal_id;
  if v_p.status <> 'awaiting_recipient_acceptance' then
    raise exception 'Not awaiting recipient acceptance';
  end if;

  insert into public.routed_settlement_approvals (proposal_id, household_id, membership_id, role, decision, note)
  values (p_proposal_id, v_p.household_id, v_actor, 'recipient',
    case when p_decision = 'accepted' then 'accepted' else 'rejected' end, p_note);

  if p_decision <> 'accepted' then
    update public.routed_settlement_proposals set status = 'rejected', updated_at = now() where id = p_proposal_id;
    update public.routed_settlement_reservations set status = 'released', updated_at = now()
    where proposal_id = p_proposal_id and status = 'active';
    insert into public.routed_settlement_events (proposal_id, household_id, event_type, actor_membership_id)
    values (p_proposal_id, v_p.household_id, 'settlement.route_rejected', v_actor);
    return;
  end if;

  update public.routed_settlement_proposals set status = 'ready_to_pay', updated_at = now() where id = p_proposal_id;
  insert into public.routed_settlement_events (proposal_id, household_id, event_type, actor_membership_id)
  values (p_proposal_id, v_p.household_id, 'settlement.route_recipient_accepted', v_actor);

  v_payer_user := public._membership_user_id(v_p.payer_membership_id);
  if v_payer_user is not null then
    perform public._emit_notification_event(
      v_p.household_id,
      'settlement.ready_to_pay',
      'routed_settlement',
      p_proposal_id,
      v_actor,
      jsonb_build_object('source_type', 'routed_settlement', 'source_id', p_proposal_id),
      'settlement.ready_to_pay:' || p_proposal_id::text,
      array[v_payer_user],
      'Routed payment is ready',
      'Pay the recipient outside the app, then record it here.',
      '/app/' || v_p.household_id::text || '/money/simplify/' || p_proposal_id::text
    );
  end if;
end;
$$;

create or replace function public.submit_routed_settlement_payment(
  p_proposal_id uuid,
  p_external_method text,
  p_idempotency_key text,
  p_public_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.routed_settlement_proposals%rowtype;
  v_actor uuid;
  v_payment_id uuid;
  v_recipients uuid[];
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_idempotency_key is null or char_length(trim(p_idempotency_key)) < 8 then
    raise exception 'Idempotency key required';
  end if;
  select * into v_p from public.routed_settlement_proposals where id = p_proposal_id for update;
  if not found then raise exception 'Proposal not found'; end if;
  v_actor := public.current_membership_id(v_p.household_id);
  if v_actor <> v_p.payer_membership_id then
    raise exception 'Only the payer may record the external payment';
  end if;
  if public._mark_routed_stale_if_needed(p_proposal_id) then
    raise exception 'Proposal became stale; balances changed';
  end if;
  select * into v_p from public.routed_settlement_proposals where id = p_proposal_id;
  if v_p.status <> 'ready_to_pay' then raise exception 'Not ready to pay'; end if;

  perform set_config('householdos.payment_mutation', 'rpc', true);

  if v_p.payment_id is not null then
    return v_p.payment_id;
  end if;

  select id into v_payment_id
  from public.payments
  where household_id = v_p.household_id
    and sender_membership_id = v_p.payer_membership_id
    and client_idempotency_key = trim(p_idempotency_key);
  if found then
    update public.routed_settlement_proposals
    set status = 'submitted', payment_id = v_payment_id, updated_at = now()
    where id = p_proposal_id;
    return v_payment_id;
  end if;

  -- External A→C payment with no pairwise allocations; legs reduce on confirm.
  insert into public.payments (
    household_id, sender_membership_id, recipient_membership_id,
    created_by_membership_id, total_amount_cents, currency, external_method, status,
    client_idempotency_key, public_note, claimed_paid_at, submitted_at
  ) values (
    v_p.household_id, v_p.payer_membership_id, v_p.recipient_membership_id,
    v_actor, v_p.amount_cents, v_p.currency, p_external_method, 'submitted',
    trim(p_idempotency_key), nullif(trim(coalesce(p_public_note, '')), ''), now(), now()
  ) returning id into v_payment_id;

  update public.routed_settlement_proposals
  set status = 'submitted', payment_id = v_payment_id, updated_at = now()
  where id = p_proposal_id;

  insert into public.routed_settlement_payment_links (proposal_id, household_id, payment_id)
  values (p_proposal_id, v_p.household_id, v_payment_id);

  insert into public.routed_settlement_events (proposal_id, household_id, event_type, actor_membership_id, detail)
  values (p_proposal_id, v_p.household_id, 'settlement.payment_submitted', v_actor,
    jsonb_build_object('payment_id', v_payment_id));

  select array_remove(array[
    public._membership_user_id(v_p.recipient_membership_id),
    public._membership_user_id(v_p.intermediary_membership_id)
  ], null) into v_recipients;

  if v_recipients is not null and cardinality(v_recipients) > 0 then
    perform public._emit_notification_event(
      v_p.household_id,
      'settlement.payment_submitted',
      'routed_settlement',
      p_proposal_id,
      v_actor,
      jsonb_build_object('source_type', 'routed_settlement', 'source_id', p_proposal_id),
      'settlement.payment_submitted:' || p_proposal_id::text,
      v_recipients,
      'Routed payment recorded',
      'Confirm receipt in the app after the external transfer arrives.',
      '/app/' || v_p.household_id::text || '/money/simplify/' || p_proposal_id::text
    );
  end if;

  return v_payment_id;
end;
$$;

create or replace function public.confirm_routed_settlement(p_proposal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.routed_settlement_proposals%rowtype;
  v_actor uuid;
  v_ab integer;
  v_bc integer;
  v_recipients uuid[];
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform set_config('householdos.payment_mutation', 'rpc', true);

  select * into v_p from public.routed_settlement_proposals where id = p_proposal_id for update;
  if not found then raise exception 'Proposal not found'; end if;
  v_actor := public.current_membership_id(v_p.household_id);
  if v_actor <> v_p.recipient_membership_id then
    raise exception 'Only the recipient may confirm receipt';
  end if;
  if v_p.status <> 'submitted' then raise exception 'Payment not submitted'; end if;

  perform 1 from public.reimbursement_obligations
  where id = v_p.source_obligation_ab_id for update;
  perform 1 from public.reimbursement_obligations
  where id = v_p.source_obligation_bc_id for update;

  v_ab := public._official_outstanding_cents(v_p.source_obligation_ab_id);
  v_bc := public._official_outstanding_cents(v_p.source_obligation_bc_id);
  if v_ab < v_p.amount_cents or v_bc < v_p.amount_cents then
    update public.routed_settlement_proposals set status = 'stale', updated_at = now() where id = p_proposal_id;
    update public.routed_settlement_reservations set status = 'released', updated_at = now()
    where proposal_id = p_proposal_id and status = 'active';
    raise exception 'Balances no longer support this routed amount';
  end if;

  -- Reduce both obligation legs (ledger keeps originals via original_amount_cents + events)
  update public.reimbursement_obligations
  set current_amount_cents = current_amount_cents - v_p.amount_cents,
      updated_at = now()
  where id = v_p.source_obligation_ab_id;

  update public.reimbursement_obligations
  set current_amount_cents = current_amount_cents - v_p.amount_cents,
      updated_at = now()
  where id = v_p.source_obligation_bc_id;

  perform public._sync_obligation_settlement_status(v_p.source_obligation_ab_id);
  perform public._sync_obligation_settlement_status(v_p.source_obligation_bc_id);

  update public.payments
  set status = 'confirmed',
      confirmed_at = now(),
      confirmed_by_membership_id = v_actor,
      updated_at = now()
  where id = v_p.payment_id;

  update public.routed_settlement_reservations set status = 'consumed', updated_at = now()
  where proposal_id = p_proposal_id and status = 'active';

  update public.routed_settlement_proposals set status = 'confirmed', updated_at = now() where id = p_proposal_id;

  insert into public.routed_settlement_events (proposal_id, household_id, event_type, actor_membership_id)
  values (p_proposal_id, v_p.household_id, 'settlement.payment_confirmed', v_actor);

  insert into public.audit_events (
    household_id, actor_user_id, entity_type, entity_id, event_type, after_state
  ) values (
    v_p.household_id, auth.uid(), 'routed_settlement', p_proposal_id, 'settlement.payment_confirmed',
    jsonb_build_object('amount_cents', v_p.amount_cents, 'payment_id', v_p.payment_id)
  );

  select array_remove(array[
    public._membership_user_id(v_p.payer_membership_id),
    public._membership_user_id(v_p.intermediary_membership_id)
  ], null) into v_recipients;

  if v_recipients is not null and cardinality(v_recipients) > 0 then
    perform public._emit_notification_event(
      v_p.household_id,
      'settlement.payment_confirmed',
      'routed_settlement',
      p_proposal_id,
      v_actor,
      jsonb_build_object('source_type', 'routed_settlement', 'source_id', p_proposal_id),
      'settlement.payment_confirmed:' || p_proposal_id::text,
      v_recipients,
      'Routed payment confirmed',
      'Balances were simplified after the external payment was confirmed.',
      '/app/' || v_p.household_id::text || '/money/simplify/' || p_proposal_id::text
    );
  end if;
end;
$$;

create or replace function public.reverse_routed_settlement(
  p_proposal_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.routed_settlement_proposals%rowtype;
  v_actor uuid;
  v_recipients uuid[];
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_reason is null or char_length(trim(p_reason)) < 3 then
    raise exception 'Reason required';
  end if;
  perform set_config('householdos.payment_mutation', 'rpc', true);

  select * into v_p from public.routed_settlement_proposals where id = p_proposal_id for update;
  if not found then raise exception 'Proposal not found'; end if;
  if v_p.status <> 'confirmed' then raise exception 'Only confirmed routes can be reversed'; end if;
  v_actor := public.current_membership_id(v_p.household_id);
  if v_actor not in (v_p.payer_membership_id, v_p.intermediary_membership_id, v_p.recipient_membership_id)
     and not public._is_financial_coordinator(v_p.household_id) then
    raise exception 'Not authorized to reverse';
  end if;

  perform 1 from public.reimbursement_obligations
  where id = v_p.source_obligation_ab_id for update;
  perform 1 from public.reimbursement_obligations
  where id = v_p.source_obligation_bc_id for update;

  update public.reimbursement_obligations
  set current_amount_cents = current_amount_cents + v_p.amount_cents,
      updated_at = now()
  where id in (v_p.source_obligation_ab_id, v_p.source_obligation_bc_id);

  perform public._sync_obligation_settlement_status(v_p.source_obligation_ab_id);
  perform public._sync_obligation_settlement_status(v_p.source_obligation_bc_id);

  update public.routed_settlement_proposals set status = 'reversed', updated_at = now() where id = p_proposal_id;

  insert into public.routed_settlement_events (proposal_id, household_id, event_type, actor_membership_id, detail)
  values (p_proposal_id, v_p.household_id, 'settlement.route_reversed', v_actor,
    jsonb_build_object('reason', trim(p_reason)));

  select array_remove(array[
    public._membership_user_id(v_p.payer_membership_id),
    public._membership_user_id(v_p.intermediary_membership_id),
    public._membership_user_id(v_p.recipient_membership_id)
  ], null) into v_recipients;

  if v_recipients is not null and cardinality(v_recipients) > 0 then
    perform public._emit_notification_event(
      v_p.household_id,
      'settlement.route_reversed',
      'routed_settlement',
      p_proposal_id,
      v_actor,
      jsonb_build_object('source_type', 'routed_settlement', 'source_id', p_proposal_id),
      'settlement.route_reversed:' || p_proposal_id::text,
      v_recipients,
      'Routed payment reversed',
      'A simplified balance route was reversed. Review balances in the app.',
      '/app/' || v_p.household_id::text || '/money/simplify/' || p_proposal_id::text
    );
  end if;
end;
$$;

create or replace function public.cancel_routed_settlement(p_proposal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.routed_settlement_proposals%rowtype;
  v_actor uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_p from public.routed_settlement_proposals where id = p_proposal_id for update;
  if not found then raise exception 'Proposal not found'; end if;
  v_actor := public.current_membership_id(v_p.household_id);
  if v_actor <> v_p.created_by_membership_id
     and v_actor <> v_p.payer_membership_id
     and not public._is_financial_coordinator(v_p.household_id) then
    raise exception 'Not authorized to cancel';
  end if;
  if v_p.status not in (
    'draft','awaiting_intermediary_approval','awaiting_recipient_acceptance','ready_to_pay'
  ) then
    raise exception 'Cannot cancel in current status';
  end if;
  update public.routed_settlement_proposals set status = 'cancelled', updated_at = now() where id = p_proposal_id;
  update public.routed_settlement_reservations set status = 'released', updated_at = now()
  where proposal_id = p_proposal_id and status = 'active';
  insert into public.routed_settlement_events (proposal_id, household_id, event_type, actor_membership_id)
  values (p_proposal_id, v_p.household_id, 'settlement.route_cancelled', v_actor);
end;
$$;

revoke all on function public.create_routed_settlement_proposal(uuid, uuid, uuid, uuid, integer, uuid, uuid, text) from public;
revoke all on function public.approve_routed_settlement_intermediary(uuid, text, text) from public;
revoke all on function public.accept_routed_settlement_recipient(uuid, text, text) from public;
revoke all on function public.submit_routed_settlement_payment(uuid, text, text, text) from public;
revoke all on function public.confirm_routed_settlement(uuid) from public;
revoke all on function public.reverse_routed_settlement(uuid, text) from public;
revoke all on function public.cancel_routed_settlement(uuid) from public;

grant execute on function public.create_routed_settlement_proposal(uuid, uuid, uuid, uuid, integer, uuid, uuid, text) to authenticated;
grant execute on function public.approve_routed_settlement_intermediary(uuid, text, text) to authenticated;
grant execute on function public.accept_routed_settlement_recipient(uuid, text, text) to authenticated;
grant execute on function public.submit_routed_settlement_payment(uuid, text, text, text) to authenticated;
grant execute on function public.confirm_routed_settlement(uuid) to authenticated;
grant execute on function public.reverse_routed_settlement(uuid, text) to authenticated;
grant execute on function public.cancel_routed_settlement(uuid) to authenticated;
