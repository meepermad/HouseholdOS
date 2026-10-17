-- Household net settlement: one plan from each person's net.
-- Covered loops reduce both directions with no external payment.
-- A recorded payment reduces every obligation leg in its flow when the recipient confirms.

create table public.household_net_payments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  payer_membership_id uuid not null references public.household_memberships (id) on delete restrict,
  recipient_membership_id uuid not null references public.household_memberships (id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0 and amount_cents <= 1000000000),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null check (status in ('submitted', 'confirmed', 'cancelled', 'stale')),
  payment_id uuid not null references public.payments (id) on delete cascade,
  client_idempotency_key text not null check (char_length(trim(client_idempotency_key)) >= 8),
  created_by_membership_id uuid not null references public.household_memberships (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (payer_membership_id <> recipient_membership_id),
  unique (household_id, payer_membership_id, client_idempotency_key)
);

create index household_net_payments_household_status_idx
  on public.household_net_payments (household_id, status, created_at desc);

create table public.household_net_payment_legs (
  id uuid primary key default gen_random_uuid(),
  household_net_payment_id uuid not null references public.household_net_payments (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  obligation_id uuid not null references public.reimbursement_obligations (id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0 and amount_cents <= 1000000000),
  unique (household_net_payment_id, obligation_id)
);

create index household_net_payment_legs_obligation_idx
  on public.household_net_payment_legs (obligation_id);

create table public.household_net_offset_runs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by_membership_id uuid not null references public.household_memberships (id) on delete restrict,
  client_idempotency_key text not null check (char_length(trim(client_idempotency_key)) >= 8),
  created_at timestamptz not null default now(),
  unique (household_id, created_by_membership_id, client_idempotency_key)
);

create trigger household_net_payments_set_updated_at
  before update on public.household_net_payments
  for each row execute function public.set_updated_at();

create or replace function public.enforce_household_net_rpc_only()
returns trigger
language plpgsql
as $$
begin
  if public._allow_privileged_mutation() then
    return coalesce(new, old);
  end if;
  if current_setting('householdos.payment_mutation', true) is distinct from 'rpc' then
    raise exception 'Household settlement records may only be written by secure functions';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger household_net_payments_rpc_only
  before insert or update or delete on public.household_net_payments
  for each row execute function public.enforce_household_net_rpc_only();

create trigger household_net_payment_legs_rpc_only
  before insert or update or delete on public.household_net_payment_legs
  for each row execute function public.enforce_household_net_rpc_only();

create trigger household_net_offset_runs_rpc_only
  before insert or update or delete on public.household_net_offset_runs
  for each row execute function public.enforce_household_net_rpc_only();

alter table public.household_net_payments enable row level security;
alter table public.household_net_payment_legs enable row level security;
alter table public.household_net_offset_runs enable row level security;

create policy household_net_payments_select on public.household_net_payments
  for select to authenticated
  using (public.is_active_member(household_id));
create policy household_net_payments_no_write on public.household_net_payments
  for all to authenticated using (false) with check (false);

create policy household_net_payment_legs_select on public.household_net_payment_legs
  for select to authenticated
  using (public.is_active_member(household_id));
create policy household_net_payment_legs_no_write on public.household_net_payment_legs
  for all to authenticated using (false) with check (false);

create policy household_net_offset_runs_select on public.household_net_offset_runs
  for select to authenticated
  using (public.is_active_member(household_id));
create policy household_net_offset_runs_no_write on public.household_net_offset_runs
  for all to authenticated using (false) with check (false);

grant select on public.household_net_payments to authenticated;
grant select on public.household_net_payment_legs to authenticated;
grant select on public.household_net_offset_runs to authenticated;

-- Keep routed proposals from spending cents already reserved by an open household payment.
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
      - coalesce((
          select sum(l.amount_cents)::integer
          from public.household_net_payment_legs l
          join public.household_net_payments n on n.id = l.household_net_payment_id
          where l.obligation_id = p_obligation_id
            and n.status = 'submitted'
        ), 0)
  );
$$;

create or replace function public._household_net_available_cents(
  p_obligation_id uuid,
  p_exclude_net_payment_id uuid
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
        ), 0)
      - coalesce((
          select sum(pa.amount_cents)::integer
          from public.payment_allocations pa
          join public.payments p on p.id = pa.payment_id
          where pa.obligation_id = p_obligation_id
            and p.status = 'submitted'
        ), 0)
      - coalesce((
          select sum(l.amount_cents)::integer
          from public.household_net_payment_legs l
          join public.household_net_payments n on n.id = l.household_net_payment_id
          where l.obligation_id = p_obligation_id
            and n.status = 'submitted'
            and (p_exclude_net_payment_id is null or n.id <> p_exclude_net_payment_id)
        ), 0)
  );
$$;

revoke all on function public._household_net_available_cents(uuid, uuid) from public;

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
    select entry.key as membership_id, entry.value as delta_cents
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

create or replace function public._apply_household_net_reductions(
  p_household_id uuid,
  p_legs jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_updated integer;
begin
  perform set_config('householdos.payment_mutation', 'rpc', true);
  for r in
    select (leg->>'obligation_id')::uuid as obligation_id,
           sum((leg->>'amount_cents')::integer)::integer as amount_cents
    from jsonb_array_elements(p_legs) leg
    where (leg->>'obligation_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and (leg->>'amount_cents') ~ '^[0-9]+$'
    group by 1
    order by 1
  loop
    update public.reimbursement_obligations
    set current_amount_cents = current_amount_cents - r.amount_cents,
        updated_at = now()
    where id = r.obligation_id
      and household_id = p_household_id
      and current_amount_cents >= r.amount_cents;
    get diagnostics v_updated = row_count;
    if v_updated <> 1 then
      raise exception 'Balances no longer support this amount';
    end if;
    perform public._sync_obligation_settlement_status(r.obligation_id);
  end loop;
end;
$$;

revoke all on function public._apply_household_net_reductions(uuid, jsonb) from public;

create or replace function public.submit_household_net_payment(
  p_household_id uuid,
  p_recipient_membership_id uuid,
  p_amount_cents integer,
  p_external_method text,
  p_idempotency_key text,
  p_legs jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_existing public.household_net_payments%rowtype;
  v_currency text;
  v_payment_id uuid;
  v_id uuid;
  v_recipient_user uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_idempotency_key is null or char_length(trim(p_idempotency_key)) < 8 then
    raise exception 'Idempotency key required';
  end if;
  if p_external_method not in (
    'venmo', 'zelle', 'cash', 'apple_cash', 'paypal', 'bank_transfer', 'check', 'other'
  ) then
    raise exception 'Unknown payment method';
  end if;

  v_actor := public.current_membership_id(p_household_id);
  if v_actor is null then raise exception 'Not a member of this household'; end if;
  if not exists (
    select 1 from public.household_memberships m
    where m.id = p_recipient_membership_id
      and m.household_id = p_household_id
      and m.status = 'active'
  ) then
    raise exception 'Recipient is not an active member';
  end if;

  select * into v_existing
  from public.household_net_payments
  where household_id = p_household_id
    and payer_membership_id = v_actor
    and client_idempotency_key = trim(p_idempotency_key);
  if found then
    if v_existing.status in ('submitted', 'confirmed') then
      return v_existing.id;
    end if;
    raise exception 'This payment record was already cancelled. Refresh and try again.';
  end if;

  v_currency := public._check_household_net_legs(
    p_household_id,
    v_actor,
    p_recipient_membership_id,
    p_amount_cents,
    p_legs,
    null,
    'payment'
  );

  perform set_config('householdos.payment_mutation', 'rpc', true);

  insert into public.payments (
    household_id, sender_membership_id, recipient_membership_id,
    created_by_membership_id, total_amount_cents, currency, external_method, status,
    client_idempotency_key, public_note, claimed_paid_at, submitted_at
  ) values (
    p_household_id, v_actor, p_recipient_membership_id,
    v_actor, p_amount_cents, v_currency, p_external_method, 'submitted',
    trim(p_idempotency_key), null, now(), now()
  ) returning id into v_payment_id;

  insert into public.household_net_payments (
    household_id, payer_membership_id, recipient_membership_id, amount_cents, currency,
    status, payment_id, client_idempotency_key, created_by_membership_id
  ) values (
    p_household_id, v_actor, p_recipient_membership_id, p_amount_cents, v_currency,
    'submitted', v_payment_id, trim(p_idempotency_key), v_actor
  ) returning id into v_id;

  insert into public.household_net_payment_legs (
    household_net_payment_id, household_id, obligation_id, amount_cents
  )
  select v_id, p_household_id, (leg->>'obligation_id')::uuid,
         sum((leg->>'amount_cents')::integer)::integer
  from jsonb_array_elements(p_legs) leg
  where (leg->>'obligation_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (leg->>'amount_cents') ~ '^[0-9]+$'
  group by 3;

  v_recipient_user := public._membership_user_id(p_recipient_membership_id);
  if v_recipient_user is not null then
    begin
      perform public._emit_notification_event(
        p_household_id,
        'settlement.payment_submitted',
        'payment',
        v_payment_id,
        v_actor,
        jsonb_build_object('source_type', 'payment', 'source_id', v_payment_id),
        'household-net-submitted:' || v_id::text,
        array[v_recipient_user],
        'Household payment recorded',
        'Confirm the payment on the simplify page after the money arrives.',
        '/app/' || p_household_id::text || '/money/simplify'
      );
    exception when others then
      null;
    end;
  end if;

  return v_id;
end;
$$;

create or replace function public.confirm_household_net_payment(
  p_household_net_payment_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.household_net_payments%rowtype;
  v_actor uuid;
  v_legs jsonb;
  v_payer_user uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform set_config('householdos.payment_mutation', 'rpc', true);

  select * into v_row
  from public.household_net_payments
  where id = p_household_net_payment_id
  for update;
  if not found then raise exception 'Payment not found'; end if;

  v_actor := public.current_membership_id(v_row.household_id);
  if v_actor is null then raise exception 'Not a member of this household'; end if;
  if v_actor <> v_row.recipient_membership_id then
    raise exception 'Only the recipient may confirm receipt';
  end if;
  if v_row.status = 'confirmed' then
    return 'confirmed';
  end if;
  if v_row.status <> 'submitted' then
    return v_row.status;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'obligation_id', l.obligation_id,
    'amount_cents', l.amount_cents
  )), '[]'::jsonb)
  into v_legs
  from public.household_net_payment_legs l
  where l.household_net_payment_id = v_row.id;

  begin
    perform public._check_household_net_legs(
      v_row.household_id,
      v_row.payer_membership_id,
      v_row.recipient_membership_id,
      v_row.amount_cents,
      v_legs,
      v_row.id,
      'payment'
    );
  exception
    when others then
      if sqlerrm ilike '%no longer support%' or sqlerrm ilike '%Disputed%' then
        update public.household_net_payments
        set status = 'stale', updated_at = now()
        where id = v_row.id;
        update public.payments
        set status = 'cancelled',
            cancelled_at = now(),
            cancelled_by_membership_id = v_actor,
            updated_at = now()
        where id = v_row.payment_id
          and status = 'submitted';
        return 'stale';
      end if;
      raise;
  end;

  perform public._apply_household_net_reductions(v_row.household_id, v_legs);

  update public.payments
  set status = 'confirmed',
      confirmed_at = now(),
      confirmed_by_membership_id = v_actor,
      updated_at = now()
  where id = v_row.payment_id;

  update public.household_net_payments
  set status = 'confirmed', updated_at = now()
  where id = v_row.id;

  insert into public.audit_events (
    household_id, actor_user_id, entity_type, entity_id, event_type, after_state
  ) values (
    v_row.household_id, auth.uid(), 'household_net_payment', v_row.id,
    'settlement.payment_confirmed',
    jsonb_build_object('amount_cents', v_row.amount_cents, 'payment_id', v_row.payment_id)
  );

  v_payer_user := public._membership_user_id(v_row.payer_membership_id);
  if v_payer_user is not null then
    begin
      perform public._emit_notification_event(
        v_row.household_id,
        'settlement.payment_confirmed',
        'payment',
        v_row.payment_id,
        v_actor,
        jsonb_build_object('source_type', 'payment', 'source_id', v_row.payment_id),
        'household-net-confirmed:' || v_row.id::text,
        array[v_payer_user],
        'Household payment confirmed',
        'The simplify page updated the balances this payment clears.',
        '/app/' || v_row.household_id::text || '/money/simplify'
      );
    exception when others then
      null;
    end;
  end if;

  return 'confirmed';
end;
$$;

create or replace function public.cancel_household_net_payment(
  p_household_net_payment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.household_net_payments%rowtype;
  v_actor uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform set_config('householdos.payment_mutation', 'rpc', true);

  select * into v_row
  from public.household_net_payments
  where id = p_household_net_payment_id
  for update;
  if not found then raise exception 'Payment not found'; end if;
  v_actor := public.current_membership_id(v_row.household_id);
  if v_actor is null then raise exception 'Not a member of this household'; end if;
  if v_actor <> v_row.payer_membership_id
     and not public._is_financial_coordinator(v_row.household_id) then
    raise exception 'Only the payer may cancel this payment';
  end if;
  if v_row.status <> 'submitted' then
    raise exception 'This payment can no longer be cancelled';
  end if;

  update public.payments
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by_membership_id = v_actor,
      updated_at = now()
  where id = v_row.payment_id
    and status = 'submitted';

  update public.household_net_payments
  set status = 'cancelled', updated_at = now()
  where id = v_row.id;
end;
$$;

create or replace function public.clear_household_net_offsets(
  p_household_id uuid,
  p_idempotency_key text,
  p_legs jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_existing uuid;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_idempotency_key is null or char_length(trim(p_idempotency_key)) < 8 then
    raise exception 'Idempotency key required';
  end if;
  v_actor := public.current_membership_id(p_household_id);
  if v_actor is null then raise exception 'Not a member of this household'; end if;

  select id into v_existing
  from public.household_net_offset_runs
  where household_id = p_household_id
    and created_by_membership_id = v_actor
    and client_idempotency_key = trim(p_idempotency_key);
  if found then
    return v_existing;
  end if;

  perform public._check_household_net_legs(
    p_household_id, null, null, null, p_legs, null, 'offset'
  );
  perform public._apply_household_net_reductions(p_household_id, p_legs);

  insert into public.household_net_offset_runs (
    household_id, created_by_membership_id, client_idempotency_key
  ) values (
    p_household_id, v_actor, trim(p_idempotency_key)
  ) returning id into v_id;

  insert into public.audit_events (
    household_id, actor_user_id, entity_type, entity_id, event_type, after_state
  ) values (
    p_household_id, auth.uid(), 'household_net_offset', v_id,
    'settlement.offsets_cleared',
    jsonb_build_object('leg_count', jsonb_array_length(p_legs))
  );

  return v_id;
end;
$$;

revoke all on function public.submit_household_net_payment(uuid, uuid, integer, text, text, jsonb) from public;
revoke all on function public.confirm_household_net_payment(uuid) from public;
revoke all on function public.cancel_household_net_payment(uuid) from public;
revoke all on function public.clear_household_net_offsets(uuid, text, jsonb) from public;

grant execute on function public.submit_household_net_payment(uuid, uuid, integer, text, text, jsonb) to authenticated;
grant execute on function public.confirm_household_net_payment(uuid) to authenticated;
grant execute on function public.cancel_household_net_payment(uuid) to authenticated;
grant execute on function public.clear_household_net_offsets(uuid, text, jsonb) to authenticated;
