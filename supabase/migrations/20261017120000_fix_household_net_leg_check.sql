-- The balance check selected key/value after those columns had been renamed.
create or replace function public._check_household_net_legs(
  p_household_id uuid,
  p_payer uuid,
  p_recipient uuid,
  p_amount integer,
  p_legs jsonb,
  p_exclude_net_payment_id uuid,
  p_mode text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
  r record;
  v_obl public.reimbursement_obligations%rowtype;
  v_available integer;
  v_currency text;
  v_leg_currency text;
  v_delta jsonb := '{}'::jsonb;
  v_debtor text;
  v_creditor text;
  v_next integer;
begin
  if p_mode not in ('payment', 'offset') then
    raise exception 'Invalid settlement mode';
  end if;
  if p_legs is null or jsonb_typeof(p_legs) <> 'array' or jsonb_array_length(p_legs) = 0 then
    raise exception 'Settlement legs are required';
  end if;
  if jsonb_array_length(p_legs) > 200 then
    raise exception 'Too many settlement legs';
  end if;
  if p_mode = 'payment' then
    if p_payer is null or p_recipient is null or p_payer = p_recipient then
      raise exception 'Payment parties are invalid';
    end if;
    if p_amount is null or p_amount <= 0 or p_amount > 1000000000 then
      raise exception 'Invalid payment amount';
    end if;
  end if;

  select coalesce(array_agg(x.obligation_id order by x.obligation_id), '{}')
  into v_ids
  from (
    select distinct (leg->>'obligation_id')::uuid as obligation_id
    from jsonb_array_elements(p_legs) leg
    where (leg->>'obligation_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and (leg->>'amount_cents') ~ '^[0-9]+$'
  ) x;

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'Settlement legs are required';
  end if;

  perform 1
  from public.reimbursement_obligations o
  where o.id = any (v_ids)
  order by o.id
  for update;

  for r in
    select (leg->>'obligation_id')::uuid as obligation_id,
           sum((leg->>'amount_cents')::integer)::integer as amount_cents
    from jsonb_array_elements(p_legs) leg
    where (leg->>'obligation_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and (leg->>'amount_cents') ~ '^[0-9]+$'
    group by 1
    order by 1
  loop
    if r.amount_cents is null or r.amount_cents <= 0 or r.amount_cents > 1000000000 then
      raise exception 'Invalid settlement leg';
    end if;

    select * into v_obl
    from public.reimbursement_obligations
    where id = r.obligation_id;
    if not found or v_obl.household_id <> p_household_id then
      raise exception 'Obligation not found in household';
    end if;
    if v_obl.status in ('reversed', 'waived') or v_obl.current_amount_cents <= 0 then
      raise exception 'Balances no longer support this amount';
    end if;
    if exists (
      select 1
      from public.reimbursement_disputes d
      where d.household_id = p_household_id
        and d.status in ('open', 'under_review')
        and (
          d.obligation_id = v_obl.id
          or (v_obl.expense_id is not null and d.expense_id = v_obl.expense_id)
        )
    ) then
      raise exception 'Disputed expenses stay out of the household plan';
    end if;

    select coalesce(
      (select e.currency from public.expenses e where e.id = v_obl.expense_id),
      (select h.currency from public.households h where h.id = p_household_id),
      'USD'
    ) into v_leg_currency;
    if v_currency is null then
      v_currency := v_leg_currency;
    elsif v_currency is distinct from v_leg_currency then
      raise exception 'Payment currency must match the household';
    end if;

    v_available := public._household_net_available_cents(r.obligation_id, p_exclude_net_payment_id);
    if r.amount_cents > v_available then
      raise exception 'Balances no longer support this amount';
    end if;

    v_debtor := v_obl.debtor_membership_id::text;
    v_creditor := v_obl.creditor_membership_id::text;
    v_next := coalesce((v_delta ->> v_debtor)::integer, 0) + r.amount_cents;
    v_delta := jsonb_set(v_delta, array[v_debtor], to_jsonb(v_next), true);
    v_next := coalesce((v_delta ->> v_creditor)::integer, 0) - r.amount_cents;
    v_delta := jsonb_set(v_delta, array[v_creditor], to_jsonb(v_next), true);
  end loop;

  for r in
    select entry.membership_id, entry.delta_cents
    from jsonb_each_text(v_delta) as entry(membership_id, delta_cents)
  loop
    if p_mode = 'offset' then
      if r.delta_cents::integer <> 0 then
        raise exception 'Canceled amounts must leave every balance unchanged';
      end if;
    else
      if r.membership_id = p_payer::text then
        if r.delta_cents::integer <> p_amount then
          raise exception 'Payment does not match the balances it clears';
        end if;
      elsif r.membership_id = p_recipient::text then
        if r.delta_cents::integer <> -p_amount then
          raise exception 'Payment does not match the balances it clears';
        end if;
      elsif r.delta_cents::integer <> 0 then
        raise exception 'Payment does not match the balances it clears';
      end if;
    end if;
  end loop;

  if p_mode = 'payment' then
    if coalesce((v_delta ->> p_payer::text)::integer, 0) <> p_amount
       or coalesce((v_delta ->> p_recipient::text)::integer, 0) <> -p_amount then
      raise exception 'Payment does not match the balances it clears';
    end if;
  end if;

  if v_currency is distinct from (
    select h.currency from public.households h where h.id = p_household_id
  ) then
    raise exception 'Payment currency must match the household';
  end if;

  return v_currency;
end;
$$;

revoke all on function public._check_household_net_legs(uuid, uuid, uuid, integer, jsonb, uuid, text) from public;
