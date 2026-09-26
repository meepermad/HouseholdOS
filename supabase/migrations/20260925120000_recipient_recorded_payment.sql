-- Recipient-recorded payments settle immediately.
-- A matching payer report is confirmed in place so the same money is not applied twice.
-- Payer association writes an audit event and does not create another settlement.

create or replace function public.record_received_payment(
  p_household_id uuid,
  p_payer_membership_id uuid,
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
  v_actor uuid;
  v_currency text;
  v_payment public.payments%rowtype;
  v_match uuid;
  v_corr uuid := gen_random_uuid();
  v_alloc jsonb;
  v_obl_id uuid;
  v_amt integer;
  v_sum integer := 0;
  v_outstanding integer;
  v_pending integer;
  v_obl public.reimbursement_obligations%rowtype;
  v_row record;
  v_ids uuid[];
  v_payer_user uuid;
  v_actor_name text;
  v_amount_text text;
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
  if p_external_method is null or p_external_method not in (
    'venmo', 'zelle', 'cash', 'apple_cash', 'paypal', 'bank_transfer', 'check', 'other'
  ) then
    raise exception 'Invalid payment amount';
  end if;

  perform set_config('householdos.payment_mutation', 'rpc', true);

  if not public.is_active_member(p_household_id) then
    raise exception 'Not an active member of this household';
  end if;

  v_actor := public.current_membership_id(p_household_id);
  if v_actor is null then
    raise exception 'Active membership required';
  end if;
  if p_payer_membership_id is null or p_payer_membership_id = v_actor then
    raise exception 'Invalid payer';
  end if;
  if not public.membership_belongs_to_household(p_payer_membership_id, p_household_id) then
    raise exception 'Cross-household obligation';
  end if;
  if not exists (
    select 1 from public.household_memberships m
    where m.id = p_payer_membership_id and m.status = 'active'
  ) then
    raise exception 'Removed member';
  end if;

  select currency into v_currency from public.households where id = p_household_id;
  if v_currency is null then
    raise exception 'Household not found';
  end if;

  select * into v_payment
  from public.payments
  where household_id = p_household_id
    and sender_membership_id = p_payer_membership_id
    and client_idempotency_key = trim(p_idempotency_key);
  if found then
    return v_payment;
  end if;

  select array_agg((elem->>'obligation_id')::uuid order by (elem->>'obligation_id')::uuid)
    into v_ids
  from jsonb_array_elements(p_allocations) as elem;

  if v_ids is null or array_length(v_ids, 1) is distinct from jsonb_array_length(p_allocations) then
    raise exception 'No obligations selected';
  end if;
  if (select count(distinct id) from unnest(v_ids) as id) <> array_length(v_ids, 1) then
    raise exception 'No obligations selected';
  end if;

  for v_obl_id in select unnest(v_ids) order by 1
  loop
    select * into v_obl
    from public.reimbursement_obligations
    where id = v_obl_id
    for update;
    if not found then
      raise exception 'Ineligible obligation %', v_obl_id;
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
    if v_obl.creditor_membership_id is distinct from v_actor then
      raise exception 'Only the person owed may record receipt';
    end if;
    if v_obl.debtor_membership_id is distinct from p_payer_membership_id then
      raise exception 'Invalid payer';
    end if;
    if v_obl.status = 'reversed' then
      raise exception 'Ineligible obligation %', v_obl_id;
    end if;
    if v_obl.expense_id is not null then
      select e.currency into v_obl_currency from public.expenses e where e.id = v_obl.expense_id;
    else
      v_obl_currency := v_currency;
    end if;
    if v_obl_currency is distinct from v_currency then
      raise exception 'Currency mismatch';
    end if;
    v_sum := v_sum + v_amt;
  end loop;

  if v_sum <> p_total_amount_cents then
    raise exception 'Allocation sum mismatch';
  end if;

  select p.id into v_match
  from public.payments p
  where p.household_id = p_household_id
    and p.sender_membership_id = p_payer_membership_id
    and p.recipient_membership_id = v_actor
    and p.status = 'submitted'
    and p.total_amount_cents = p_total_amount_cents
    and (
      select count(*) from public.payment_allocations pa where pa.payment_id = p.id
    ) = jsonb_array_length(p_allocations)
    and not exists (
      select 1
      from jsonb_array_elements(p_allocations) elem
      where not exists (
        select 1
        from public.payment_allocations pa
        where pa.payment_id = p.id
          and pa.obligation_id = (elem->>'obligation_id')::uuid
          and pa.amount_cents = (elem->>'amount_cents')::integer
      )
    )
  order by p.created_at
  limit 1
  for update;

  select coalesce(nullif(trim(pr.display_name), ''), 'Your roommate')
    into v_actor_name
  from public.household_memberships m
  join public.profiles pr on pr.id = m.user_id
  where m.id = v_actor;
  v_actor_name := left(coalesce(v_actor_name, 'Your roommate'), 80);
  v_amount_text := to_char(p_total_amount_cents / 100.0, 'FM999999990.00');

  if v_match is not null then
    select * into v_payment from public.payments where id = v_match for update;
    if v_payment.status = 'confirmed' then
      return v_payment;
    end if;
    if v_payment.status <> 'submitted' then
      raise exception 'Payment already %', v_payment.status;
    end if;

    for v_row in
      select pa.obligation_id, pa.amount_cents
      from public.payment_allocations pa
      where pa.payment_id = v_match
      order by pa.obligation_id
    loop
      perform 1 from public.reimbursement_obligations o
      where o.id = v_row.obligation_id
      for update;
      v_outstanding := public._official_outstanding_cents(v_row.obligation_id);
      if v_row.amount_cents > v_outstanding then
        raise exception 'Confirmation conflict: obligation changed since review';
      end if;
    end loop;

    update public.payments
    set status = 'confirmed',
        confirmed_at = now(),
        confirmed_by_membership_id = v_actor,
        updated_at = now()
    where id = v_match
    returning * into v_payment;

    for v_obl_id in
      select pa.obligation_id from public.payment_allocations pa where pa.payment_id = v_match
    loop
      perform public._sync_obligation_settlement_status(v_obl_id);
    end loop;

    perform public._payment_audit(
      p_household_id, 'payment', v_payment.id, 'payment.confirmed',
      jsonb_build_object('status', 'submitted'),
      jsonb_build_object('status', 'confirmed', 'recorded_by', 'recipient'),
      null, v_corr
    );

    v_payer_user := public._membership_user_id(p_payer_membership_id);
    perform public._emit_notification_event(
      p_household_id,
      'payment.confirmed',
      'payment',
      v_payment.id,
      v_actor,
      jsonb_build_object('payment_id', v_payment.id, 'total_amount_cents', p_total_amount_cents),
      'payment.confirmed:' || v_payment.id::text,
      array[v_payer_user],
      'Payment received',
      v_actor_name || ' acknowledged receiving your $' || v_amount_text || ' payment.',
      '/app/' || p_household_id::text || '/money/payments/' || v_payment.id::text
    );
    return v_payment;
  end if;

  for v_alloc in select value from jsonb_array_elements(p_allocations) as t(value)
  loop
    v_obl_id := (v_alloc->>'obligation_id')::uuid;
    v_amt := (v_alloc->>'amount_cents')::integer;
    v_outstanding := public._official_outstanding_cents(v_obl_id);
    v_pending := coalesce((
      select sum(pa.amount_cents)::integer
      from public.payment_allocations pa
      join public.payments p on p.id = pa.payment_id
      where pa.obligation_id = v_obl_id and p.status = 'submitted'
    ), 0);
    v_outstanding := v_outstanding - v_pending - public._routed_reserved_cents(v_obl_id);
    if v_pending > 0 and v_amt > v_outstanding then
      raise exception 'Reported payment still waiting';
    end if;
    if v_amt > v_outstanding then
      raise exception 'Allocation exceeds outstanding balance';
    end if;
  end loop;

  insert into public.payments (
    household_id, sender_membership_id, recipient_membership_id, created_by_membership_id,
    currency, total_amount_cents, external_method, claimed_paid_at, status, public_note,
    client_idempotency_key, submitted_at, confirmed_at, confirmed_by_membership_id
  ) values (
    p_household_id, p_payer_membership_id, v_actor, v_actor,
    v_currency, p_total_amount_cents, p_external_method, p_claimed_paid_at, 'confirmed',
    nullif(trim(coalesce(p_public_note, '')), ''),
    trim(p_idempotency_key), now(), now(), v_actor
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
    perform public._sync_obligation_settlement_status((v_alloc->>'obligation_id')::uuid);
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
    p_household_id, 'payment', v_payment.id, 'payment.recipient_recorded',
    null,
    jsonb_build_object(
      'status', 'confirmed',
      'total_amount_cents', p_total_amount_cents,
      'created_by_membership_id', v_actor,
      'sender_membership_id', p_payer_membership_id
    ),
    null, v_corr
  );

  v_payer_user := public._membership_user_id(p_payer_membership_id);
  perform public._emit_notification_event(
    p_household_id,
    'payment.confirmed',
    'payment',
    v_payment.id,
    v_actor,
    jsonb_build_object('payment_id', v_payment.id, 'total_amount_cents', p_total_amount_cents),
    'payment.recipient_recorded:' || v_payment.id::text,
    array[v_payer_user],
    'Payment received',
    v_actor_name || ' recorded receiving your $' || v_amount_text || ' payment.',
    '/app/' || p_household_id::text || '/money/payments/' || v_payment.id::text
  );

  return v_payment;
end;
$$;

revoke all on function public.record_received_payment(uuid, uuid, integer, text, jsonb, text, timestamptz, text, text, text) from public;
grant execute on function public.record_received_payment(uuid, uuid, integer, text, jsonb, text, timestamptz, text, text, text) to authenticated;

create or replace function public.associate_payer_report(
  p_payment_id uuid,
  p_idempotency_key text,
  p_note text default null
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_actor uuid;
  v_corr uuid := gen_random_uuid();
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_idempotency_key is null or char_length(trim(p_idempotency_key)) < 8 then
    raise exception 'Idempotency key required';
  end if;

  perform set_config('householdos.payment_mutation', 'rpc', true);

  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment not found';
  end if;
  if not public.is_active_member(v_payment.household_id) then
    raise exception 'Not an active member of this household';
  end if;
  v_actor := public.current_membership_id(v_payment.household_id);
  if v_actor is distinct from v_payment.sender_membership_id then
    raise exception 'Only the payer may associate a report';
  end if;
  if v_payment.status <> 'confirmed' then
    raise exception 'Payment already %', v_payment.status;
  end if;

  if exists (
    select 1
    from public.audit_events e
    where e.entity_id = p_payment_id
      and e.event_type = 'payment.payer_associated'
      and e.after_state->>'idempotency_key' = trim(p_idempotency_key)
  ) then
    return v_payment;
  end if;

  perform public._payment_audit(
    v_payment.household_id,
    'payment',
    p_payment_id,
    'payment.payer_associated',
    null,
    jsonb_build_object(
      'idempotency_key', trim(p_idempotency_key),
      'created_by_membership_id', v_payment.created_by_membership_id,
      'associated_by_membership_id', v_actor
    ),
    nullif(trim(coalesce(p_note, '')), ''),
    v_corr
  );

  return v_payment;
end;
$$;

revoke all on function public.associate_payer_report(uuid, text, text) from public;
grant execute on function public.associate_payer_report(uuid, text, text) to authenticated;
