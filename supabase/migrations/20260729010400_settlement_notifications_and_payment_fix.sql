-- Completion-B: settlement notification meta + opening-balance payment currency fix

create or replace function public._notification_meta_for_event_type(p_event_type text)
returns table (
  category text,
  urgency text,
  action_oriented boolean
)
language sql
immutable
as $$
  select
    case
      when p_event_type like 'dispute.%' then 'disputes'
      when p_event_type like 'payment.%'
        or p_event_type like 'waiver.%'
        or p_event_type like 'refund_obligation.%'
        or p_event_type like 'expense.%'
        or p_event_type like 'settlement.%'
        or p_event_type like 'opening_balance.%' then 'payments'
      when p_event_type like 'membership.%' then 'membership'
      when p_event_type like 'chore.%' then 'chores'
      when p_event_type like 'calendar.%' then 'calendar'
      when p_event_type like 'inventory.%'
        or p_event_type like 'pantry.%'
        or p_event_type like 'shopping.%'
        or p_event_type like 'house.%' then 'house'
      when p_event_type like 'recipe.%'
        or p_event_type like 'meal.%'
        or p_event_type like 'meal_prep.%'
        or p_event_type like 'meal_batch.%' then 'meals'
      when p_event_type like 'maintenance.%' then 'maintenance'
      when p_event_type like 'governance.%'
        or p_event_type like 'agreement.%' then 'agreements'
      when p_event_type like 'system.%' then 'system'
      else 'system'
    end,
    case
      when p_event_type in (
        'payment.awaiting_confirmation',
        'payment.rejected',
        'payment.reversed',
        'waiver.reversed',
        'dispute.opened',
        'refund_obligation.created',
        'expense.voided',
        'meal.cancelled',
        'meal.shopping_needed',
        'maintenance.reported',
        'maintenance.severity_changed',
        'maintenance.appointment_scheduled',
        'calendar.sync_failure',
        'calendar.external_auth_expired',
        'calendar.conflict_introduced',
        'settlement.intermediary_approval_required',
        'settlement.recipient_acceptance_required',
        'settlement.route_stale',
        'settlement.route_reversed'
      ) then 'high'
      when p_event_type like 'system.%urgent%'
        or p_event_type = 'maintenance.reopened' then 'urgent'
      else 'normal'
    end,
    case
      when p_event_type in (
        'payment.awaiting_confirmation',
        'payment.rejected',
        'waiver.created',
        'waiver.reversed',
        'dispute.opened',
        'refund_obligation.created',
        'expense.voided',
        'expense.amended',
        'meal.rsvp_requested',
        'meal.shopping_needed',
        'meal.cleanup_assigned',
        'maintenance.assigned',
        'maintenance.waiting_on_household',
        'maintenance.appointment_scheduled',
        'maintenance.vendor_response_needed',
        'calendar.invitation',
        'calendar.event_requires_reconfirm',
        'calendar.availability_request',
        'calendar.sync_failure',
        'calendar.external_auth_expired',
        'calendar.conflict_introduced',
        'settlement.intermediary_approval_required',
        'settlement.recipient_acceptance_required',
        'settlement.ready_to_pay',
        'settlement.payment_submitted',
        'opening_balance.confirmation_required'
      ) then true
      else false
    end;
$$;

revoke all on function public._notification_meta_for_event_type(text) from public;

-- Allow payments against opening_balance obligations (null expense_id)
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
  v_obl_currency text;
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

    if v_obl.expense_id is not null then
      select e.currency into v_obl_currency
      from public.expenses e where e.id = v_obl.expense_id;
    else
      v_obl_currency := v_currency;
    end if;
    if v_obl_currency is distinct from v_currency then
      raise exception 'Currency mismatch';
    end if;

    v_outstanding := public._official_outstanding_cents(v_obl_id);
    v_outstanding := v_outstanding - coalesce((
      select sum(pa.amount_cents)::integer
      from public.payment_allocations pa
      join public.payments p on p.id = pa.payment_id
      where pa.obligation_id = v_obl_id and p.status = 'submitted'
    ), 0);
    -- Routed reservations hold capacity for simplify proposals
    v_outstanding := v_outstanding - public._routed_reserved_cents(v_obl_id);

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
