-- Phase 3: ledger-derived obligation balances

create or replace view public.obligation_balances_v
with (security_invoker = true)
as
with confirmed_paid as (
  select pa.obligation_id, coalesce(sum(pa.amount_cents), 0)::integer as cents
  from public.payment_allocations pa
  join public.payments p on p.id = pa.payment_id
  where p.status = 'confirmed'
  group by pa.obligation_id
),
pending_paid as (
  select pa.obligation_id, coalesce(sum(pa.amount_cents), 0)::integer as cents
  from public.payment_allocations pa
  join public.payments p on p.id = pa.payment_id
  where p.status = 'submitted'
  group by pa.obligation_id
),
waived as (
  select w.obligation_id, coalesce(sum(w.amount_cents), 0)::integer as cents
  from public.reimbursement_waivers w
  where w.status = 'active'
  group by w.obligation_id
)
select
  o.id as obligation_id,
  o.household_id,
  o.expense_id,
  o.debtor_membership_id,
  o.creditor_membership_id,
  o.obligation_kind,
  o.status as stored_status,
  o.original_amount_cents,
  o.current_amount_cents as effective_amount_cents,
  coalesce(cp.cents, 0) as confirmed_paid_cents,
  coalesce(pp.cents, 0) as pending_payment_cents,
  coalesce(w.cents, 0) as waived_cents,
  case
    when o.status = 'reversed' or o.current_amount_cents = 0 then 0
    else greatest(0, o.current_amount_cents - coalesce(cp.cents, 0) - coalesce(w.cents, 0))
  end as official_outstanding_cents,
  case
    when o.status = 'reversed' or o.current_amount_cents = 0 then 0
    else greatest(
      0,
      greatest(0, o.current_amount_cents - coalesce(cp.cents, 0) - coalesce(w.cents, 0))
        - coalesce(pp.cents, 0)
    )
  end as projected_outstanding_cents,
  case
    when o.status = 'reversed' then 'reversed'
    when o.current_amount_cents = 0 then 'settled'
    when greatest(0, o.current_amount_cents - coalesce(cp.cents, 0) - coalesce(w.cents, 0)) = 0
      then 'settled'
    when greatest(0, o.current_amount_cents - coalesce(cp.cents, 0) - coalesce(w.cents, 0))
           < o.current_amount_cents
      then 'partially_settled'
    else 'unpaid'
  end as settlement_state,
  o.created_at,
  o.updated_at
from public.reimbursement_obligations o
left join confirmed_paid cp on cp.obligation_id = o.id
left join pending_paid pp on pp.obligation_id = o.id
left join waived w on w.obligation_id = o.id;

grant select on public.obligation_balances_v to authenticated;

-- Official outstanding helper used inside RPCs (caller should lock obligation row)
create or replace function public._official_outstanding_cents(p_obligation_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_eff integer;
  v_status text;
  v_paid integer;
  v_waived integer;
begin
  select current_amount_cents, status
    into v_eff, v_status
  from public.reimbursement_obligations
  where id = p_obligation_id;

  if v_eff is null then
    raise exception 'Obligation not found';
  end if;
  if v_status = 'reversed' or v_eff = 0 then
    return 0;
  end if;

  select coalesce(sum(pa.amount_cents), 0)::integer into v_paid
  from public.payment_allocations pa
  join public.payments p on p.id = pa.payment_id
  where pa.obligation_id = p_obligation_id
    and p.status = 'confirmed';

  select coalesce(sum(w.amount_cents), 0)::integer into v_waived
  from public.reimbursement_waivers w
  where w.obligation_id = p_obligation_id
    and w.status = 'active';

  return greatest(0, v_eff - v_paid - v_waived);
end;
$$;

revoke all on function public._official_outstanding_cents(uuid) from public;
