-- Phase 3: payment / waiver / dispute RPCs + expanded audit allowlist

create or replace function public.write_audit_event(
  p_household_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_event_type text,
  p_before_state jsonb default null,
  p_after_state jsonb default null,
  p_reason text default null,
  p_correlation_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_allowed text[] := array[
    'household.updated',
    'household.settings_updated',
    'profile.recovered',
    'membership.status_changed',
    'membership.roles_changed',
    'invitation.created',
    'invitation.accepted',
    'invitation.declined',
    'invitation.revoked',
    'household.created',
    'household.archived',
    'expense.created',
    'expense.submitted_for_review',
    'expense.confirmed',
    'expense.amendment_created',
    'expense.amended',
    'expense.voided',
    'expense.draft_deleted',
    'reimbursement.created',
    'reimbursement.adjusted',
    'reimbursement.reversed',
    'reimbursement.waived',
    'reimbursement.partially_settled',
    'reimbursement.settled',
    'reimbursement.reopened',
    'payment.created',
    'payment.submitted',
    'payment.confirmed',
    'payment.rejected',
    'payment.cancelled',
    'payment.reversed',
    'payment.allocation_created',
    'waiver.reversed',
    'dispute.opened',
    'dispute.resolved',
    'dispute.withdrawn',
    'refund_obligation.created'
  ];
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_entity_type is null or char_length(trim(p_entity_type)) < 1 then
    raise exception 'Invalid entity type';
  end if;
  if p_entity_id is null then
    raise exception 'Invalid entity id';
  end if;
  if p_event_type is null or not (p_event_type = any (v_allowed)) then
    raise exception 'Event type not permitted';
  end if;
  if p_household_id is not null and not public.is_active_member(p_household_id) then
    raise exception 'Not an active member of this household';
  end if;
  if coalesce(p_before_state::text, '') ~* '(password|token_hash|secret|service_role)'
     or coalesce(p_after_state::text, '') ~* '(password|token_hash|secret|service_role)' then
    raise exception 'Audit payload contains forbidden fields';
  end if;

  insert into public.audit_events (
    household_id, actor_user_id, entity_type, entity_id, event_type,
    before_state, after_state, reason, correlation_id
  ) values (
    p_household_id, v_user_id, p_entity_type, p_entity_id, p_event_type,
    p_before_state, p_after_state, p_reason, coalesce(p_correlation_id, gen_random_uuid())
  )
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public._payment_audit(
  p_household_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_event_type text,
  p_before_state jsonb default null,
  p_after_state jsonb default null,
  p_reason text default null,
  p_correlation_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_events (
    household_id, actor_user_id, entity_type, entity_id, event_type,
    before_state, after_state, reason, correlation_id
  ) values (
    p_household_id, auth.uid(), p_entity_type, p_entity_id, p_event_type,
    p_before_state, p_after_state, p_reason, coalesce(p_correlation_id, gen_random_uuid())
  );
end;
$$;

revoke all on function public._payment_audit(uuid, text, uuid, text, jsonb, jsonb, text, uuid) from public;

create or replace function public._membership_user_id(p_membership_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select user_id from public.household_memberships where id = p_membership_id;
$$;

revoke all on function public._membership_user_id(uuid) from public;

-- Inline helpers used by sync (avoid view recursion)
create or replace function public.obligation_confirmed_paid_inline(p_obligation_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(pa.amount_cents), 0)::integer
  from public.payment_allocations pa
  join public.payments p on p.id = pa.payment_id
  where pa.obligation_id = p_obligation_id and p.status = 'confirmed';
$$;

create or replace function public.obligation_waived_cents_inline(p_obligation_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(w.amount_cents), 0)::integer
  from public.reimbursement_waivers w
  where w.obligation_id = p_obligation_id and w.status = 'active';
$$;

revoke all on function public.obligation_confirmed_paid_inline(uuid) from public;
revoke all on function public.obligation_waived_cents_inline(uuid) from public;

create or replace function public._sync_obligation_settlement_status(p_obligation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_obl public.reimbursement_obligations%rowtype;
  v_out integer;
  v_before text;
  v_after text;
  v_paid integer;
  v_waived integer;
begin
  select * into v_obl from public.reimbursement_obligations where id = p_obligation_id for update;
  if not found or v_obl.status = 'reversed' then
    return;
  end if;

  v_before := v_obl.status;
  v_paid := public.obligation_confirmed_paid_inline(p_obligation_id);
  v_waived := public.obligation_waived_cents_inline(p_obligation_id);
  v_out := case
    when v_obl.current_amount_cents = 0 then 0
    else greatest(0, v_obl.current_amount_cents - v_paid - v_waived)
  end;

  if v_out = 0 then
    if v_waived > 0 and v_paid = 0 then
      v_after := 'waived';
    else
      v_after := 'settled';
    end if;
  elsif v_out < v_obl.current_amount_cents then
    v_after := 'adjusted';
  else
    v_after := 'pending';
  end if;

  if v_after is distinct from v_before then
    update public.reimbursement_obligations
    set status = v_after,
        settled_at = case when v_after in ('settled', 'waived') then coalesce(settled_at, now()) else null end,
        updated_at = now()
    where id = p_obligation_id;

    if v_after = 'settled' then
      perform public._payment_audit(
        v_obl.household_id, 'reimbursement_obligation', p_obligation_id,
        'reimbursement.settled', jsonb_build_object('status', v_before),
        jsonb_build_object('status', 'settled'), null, null
      );
    elsif v_after = 'waived' then
      perform public._payment_audit(
        v_obl.household_id, 'reimbursement_obligation', p_obligation_id,
        'reimbursement.waived', jsonb_build_object('status', v_before),
        jsonb_build_object('status', 'waived'), null, null
      );
    elsif v_before in ('settled', 'waived') and v_after in ('pending', 'adjusted') then
      perform public._payment_audit(
        v_obl.household_id, 'reimbursement_obligation', p_obligation_id,
        'reimbursement.reopened', jsonb_build_object('status', v_before),
        jsonb_build_object('status', v_after), null, null
      );
    elsif v_after = 'adjusted' then
      perform public._payment_audit(
        v_obl.household_id, 'reimbursement_obligation', p_obligation_id,
        'reimbursement.partially_settled', jsonb_build_object('status', v_before),
        jsonb_build_object('status', 'adjusted'), null, null
      );
    end if;
  end if;
end;
$$;

revoke all on function public._sync_obligation_settlement_status(uuid) from public;

-- ---------------------------------------------------------------------------
-- submit_payment
-- p_allocations: [{obligation_id, amount_cents}]
-- ---------------------------------------------------------------------------
create or replace function public.submit_payment(
  p_household_id uuid,
  p_recipient_membership_id uuid,
  p_total_amount_cents integer,
  p_external_method text,
  p_allocations jsonb,
  p_idempotency_key text,
  p_claimed_paid_at timestamptz default null,
  p_public_note text default null,
  p_private_note text default null,
  p_external_reference text default null
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender uuid;
  v_currency text;
  v_payment public.payments%rowtype;
  v_corr uuid := gen_random_uuid();
  v_alloc jsonb;
  v_obl_id uuid;
  v_amt integer;
  v_sum integer := 0;
  v_outstanding integer;
  v_obl public.reimbursement_obligations%rowtype;
  v_ids uuid[];
  v_recipient_user uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_idempotency_key is null or char_length(trim(p_idempotency_key)) < 8 then
    raise exception 'Idempotency key required';
  end if;
  if p_total_amount_cents is null or p_total_amount_cents <= 0 then
    raise exception 'Invalid payment amount';
  end if;
  if p_allocations is null or jsonb_typeof(p_allocations) <> 'array'
     or jsonb_array_length(p_allocations) < 1 then
    raise exception 'No obligations selected';
  end if;

  perform set_config('householdos.payment_mutation', 'rpc', true);

  if not public.is_active_member(p_household_id) then
    raise exception 'Not an active member of this household';
  end if;

  v_sender := public.current_membership_id(p_household_id);
  if v_sender is null then
    raise exception 'Active membership required';
  end if;

  select currency into v_currency from public.households where id = p_household_id;
  if v_currency is null then
    raise exception 'Household not found';
  end if;

  -- Idempotent replay
  select * into v_payment
  from public.payments
  where household_id = p_household_id
    and sender_membership_id = v_sender
    and client_idempotency_key = trim(p_idempotency_key);

  if found then
    return v_payment;
  end if;

  if p_recipient_membership_id is null or p_recipient_membership_id = v_sender then
    raise exception 'Invalid recipient';
  end if;
  if not public.membership_belongs_to_household(p_recipient_membership_id, p_household_id) then
    raise exception 'Invalid recipient';
  end if;
  if not exists (
    select 1 from public.household_memberships m
    where m.id = p_recipient_membership_id and m.status = 'active'
  ) then
    raise exception 'Invalid recipient';
  end if;

  -- Lock obligations in stable order
  select array_agg((elem->>'obligation_id')::uuid order by (elem->>'obligation_id')::uuid)
    into v_ids
  from jsonb_array_elements(p_allocations) as elem;

  for v_obl_id in select unnest(v_ids) order by 1
  loop
    select * into v_obl
    from public.reimbursement_obligations
    where id = v_obl_id
    for update;
    if not found then
      raise exception 'Obligation not found';
    end if;
  end loop;

  for v_alloc in select value from jsonb_array_elements(p_allocations) as t(value)
  loop
    v_obl_id := (v_alloc->>'obligation_id')::uuid;
    v_amt := (v_alloc->>'amount_cents')::integer;
    if v_amt is null or v_amt <= 0 then
      raise exception 'Invalid payment amount';
    end if;

    select * into v_obl from public.reimbursement_obligations where id = v_obl_id;
    if v_obl.household_id is distinct from p_household_id then
      raise exception 'Cross-household obligation';
    end if;
    if v_obl.debtor_membership_id is distinct from v_sender then
      raise exception 'Only the debtor may create a payment against this obligation';
    end if;
    if v_obl.creditor_membership_id is distinct from p_recipient_membership_id then
      raise exception 'Invalid recipient';
    end if;
    if v_obl.status = 'reversed' then
      raise exception 'Obligation changed since review';
    end if;

    select e.currency into v_currency
    from public.expenses e where e.id = v_obl.expense_id;
    if v_currency is distinct from (select currency from public.households where id = p_household_id) then
      raise exception 'Currency mismatch';
    end if;

    v_outstanding := public._official_outstanding_cents(v_obl_id);
    -- subtract other submitted allocations
    v_outstanding := v_outstanding - coalesce((
      select sum(pa.amount_cents)::integer
      from public.payment_allocations pa
      join public.payments p on p.id = pa.payment_id
      where pa.obligation_id = v_obl_id and p.status = 'submitted'
    ), 0);

    if v_amt > v_outstanding then
      raise exception 'Allocation exceeds outstanding balance';
    end if;
    v_sum := v_sum + v_amt;
  end loop;

  if v_sum <> p_total_amount_cents then
    raise exception 'Allocation sum mismatch';
  end if;

  select currency into v_currency from public.households where id = p_household_id;

  insert into public.payments (
    household_id, sender_membership_id, recipient_membership_id, created_by_membership_id,
    currency, total_amount_cents, external_method, claimed_paid_at, status, public_note,
    client_idempotency_key, submitted_at
  ) values (
    p_household_id, v_sender, p_recipient_membership_id, v_sender,
    v_currency, p_total_amount_cents, p_external_method, p_claimed_paid_at, 'submitted',
    nullif(trim(coalesce(p_public_note, '')), ''),
    trim(p_idempotency_key), now()
  )
  returning * into v_payment;

  if nullif(trim(coalesce(p_private_note, '')), '') is not null
     or nullif(trim(coalesce(p_external_reference, '')), '') is not null then
    insert into public.payment_private_details (
      payment_id, household_id, private_note, external_reference
    ) values (
      v_payment.id, p_household_id,
      nullif(trim(coalesce(p_private_note, '')), ''),
      nullif(trim(coalesce(p_external_reference, '')), '')
    );
  end if;

  for v_alloc in select value from jsonb_array_elements(p_allocations) as t(value)
  loop
    insert into public.payment_allocations (
      payment_id, obligation_id, household_id, amount_cents
    ) values (
      v_payment.id,
      (v_alloc->>'obligation_id')::uuid,
      p_household_id,
      (v_alloc->>'amount_cents')::integer
    );

    perform public._payment_audit(
      p_household_id, 'payment_allocation',
      (select id from public.payment_allocations
       where payment_id = v_payment.id
         and obligation_id = (v_alloc->>'obligation_id')::uuid),
      'payment.allocation_created',
      null,
      jsonb_build_object(
        'payment_id', v_payment.id,
        'obligation_id', (v_alloc->>'obligation_id')::uuid,
        'amount_cents', (v_alloc->>'amount_cents')::integer
      ),
      null, v_corr
    );
  end loop;

  perform public._payment_audit(
    p_household_id, 'payment', v_payment.id, 'payment.submitted',
    null,
    jsonb_build_object(
      'total_amount_cents', p_total_amount_cents,
      'recipient_membership_id', p_recipient_membership_id,
      'external_method', p_external_method,
      'status', 'submitted'
    ),
    null, v_corr
  );

  v_recipient_user := public._membership_user_id(p_recipient_membership_id);
  perform public._emit_notification_event(
    p_household_id,
    'payment.awaiting_confirmation',
    'payment',
    v_payment.id,
    v_sender,
    jsonb_build_object(
      'payment_id', v_payment.id,
      'total_amount_cents', p_total_amount_cents,
      'external_method', p_external_method
    ),
    'payment.submitted:' || v_payment.id::text,
    array[v_recipient_user],
    'Payment awaiting confirmation',
    'A household member recorded an external payment for you to confirm.',
    '/app/' || p_household_id::text || '/money/payments/' || v_payment.id::text
  );

  return v_payment;
end;
$$;

revoke all on function public.submit_payment(uuid, uuid, integer, text, jsonb, text, timestamptz, text, text, text) from public;
grant execute on function public.submit_payment(uuid, uuid, integer, text, jsonb, text, timestamptz, text, text, text) to authenticated;
