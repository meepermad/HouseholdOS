-- Phase 3: payment settlement ledger schema

-- ---------------------------------------------------------------------------
-- Extend reimbursement_obligations for refunds / amendment lineage
-- ---------------------------------------------------------------------------
alter table public.reimbursement_obligations
  add column if not exists obligation_kind text not null default 'reimbursement'
    check (obligation_kind in ('reimbursement', 'refund')),
  add column if not exists source_obligation_id uuid
    references public.reimbursement_obligations (id) on delete set null,
  add column if not exists source_expense_amendment_id uuid
    references public.expense_amendments (id) on delete set null;

create index if not exists reimbursement_obligations_source_obligation_idx
  on public.reimbursement_obligations (source_obligation_id);

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete restrict,
  sender_membership_id uuid not null references public.household_memberships (id) on delete restrict,
  recipient_membership_id uuid not null references public.household_memberships (id) on delete restrict,
  created_by_membership_id uuid not null references public.household_memberships (id) on delete restrict,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  total_amount_cents integer not null check (total_amount_cents > 0 and total_amount_cents <= 1000000000),
  external_method text not null check (external_method in (
    'venmo', 'zelle', 'cash', 'apple_cash', 'paypal', 'bank_transfer', 'check', 'other'
  )),
  claimed_paid_at timestamptz,
  status text not null default 'draft' check (status in (
    'draft', 'submitted', 'confirmed', 'rejected', 'cancelled', 'reversed'
  )),
  public_note text check (public_note is null or char_length(public_note) <= 500),
  client_idempotency_key text not null,
  submitted_at timestamptz,
  confirmed_at timestamptz,
  confirmed_by_membership_id uuid references public.household_memberships (id) on delete restrict,
  rejected_at timestamptz,
  rejected_by_membership_id uuid references public.household_memberships (id) on delete restrict,
  rejection_reason text,
  cancelled_at timestamptz,
  cancelled_by_membership_id uuid references public.household_memberships (id) on delete restrict,
  reversed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sender_membership_id <> recipient_membership_id),
  check (
    (status = 'draft')
    or (status = 'submitted' and submitted_at is not null)
    or (status = 'confirmed' and submitted_at is not null and confirmed_at is not null
        and confirmed_by_membership_id is not null)
    or (status = 'rejected' and submitted_at is not null and rejected_at is not null
        and rejected_by_membership_id is not null
        and rejection_reason is not null and char_length(trim(rejection_reason)) >= 1)
    or (status = 'cancelled' and submitted_at is not null and cancelled_at is not null
        and cancelled_by_membership_id is not null)
    or (status = 'reversed' and submitted_at is not null and confirmed_at is not null
        and reversed_at is not null)
  ),
  unique (household_id, sender_membership_id, client_idempotency_key)
);

create index payments_household_id_idx on public.payments (household_id, created_at desc);
create index payments_sender_status_idx on public.payments (sender_membership_id, status);
create index payments_recipient_status_idx on public.payments (recipient_membership_id, status);

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- payment_private_details (sender + recipient only via RLS)
-- ---------------------------------------------------------------------------
create table public.payment_private_details (
  payment_id uuid primary key references public.payments (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete restrict,
  private_note text check (private_note is null or char_length(private_note) <= 500),
  external_reference text check (external_reference is null or char_length(external_reference) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger payment_private_details_set_updated_at
  before update on public.payment_private_details
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- payment_allocations
-- ---------------------------------------------------------------------------
create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete restrict,
  obligation_id uuid not null references public.reimbursement_obligations (id) on delete restrict,
  household_id uuid not null references public.households (id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0 and amount_cents <= 1000000000),
  created_at timestamptz not null default now(),
  unique (payment_id, obligation_id)
);

create index payment_allocations_obligation_idx
  on public.payment_allocations (obligation_id);
create index payment_allocations_household_idx
  on public.payment_allocations (household_id);

-- ---------------------------------------------------------------------------
-- payment_reversals (at most one per payment)
-- ---------------------------------------------------------------------------
create table public.payment_reversals (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.payments (id) on delete restrict,
  household_id uuid not null references public.households (id) on delete restrict,
  reversed_by_membership_id uuid not null references public.household_memberships (id) on delete restrict,
  reason text not null check (char_length(trim(reason)) >= 1),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- reimbursement_waivers + reversals
-- ---------------------------------------------------------------------------
create table public.reimbursement_waivers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete restrict,
  obligation_id uuid not null references public.reimbursement_obligations (id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0 and amount_cents <= 1000000000),
  reason text not null check (char_length(trim(reason)) >= 1),
  created_by_membership_id uuid not null references public.household_memberships (id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'reversed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reimbursement_waivers_obligation_idx
  on public.reimbursement_waivers (obligation_id, status);

create trigger reimbursement_waivers_set_updated_at
  before update on public.reimbursement_waivers
  for each row execute function public.set_updated_at();

create table public.reimbursement_waiver_reversals (
  id uuid primary key default gen_random_uuid(),
  waiver_id uuid not null unique references public.reimbursement_waivers (id) on delete restrict,
  household_id uuid not null references public.households (id) on delete restrict,
  reversed_by_membership_id uuid not null references public.household_memberships (id) on delete restrict,
  reason text not null check (char_length(trim(reason)) >= 1),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- disputes
-- ---------------------------------------------------------------------------
create table public.reimbursement_disputes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete restrict,
  raised_by_membership_id uuid not null references public.household_memberships (id) on delete restrict,
  dispute_type text not null check (dispute_type in (
    'expense_allocation',
    'obligation_amount',
    'payment_not_received',
    'incorrect_payment_amount',
    'duplicate_payment',
    'incorrect_payment_allocation',
    'other'
  )),
  reason text not null check (char_length(trim(reason)) >= 1),
  status text not null default 'open' check (status in (
    'open', 'under_review', 'resolved', 'withdrawn'
  )),
  expense_id uuid references public.expenses (id) on delete restrict,
  obligation_id uuid references public.reimbursement_obligations (id) on delete restrict,
  payment_id uuid references public.payments (id) on delete restrict,
  resolution_type text check (resolution_type is null or resolution_type in (
    'expense_amendment',
    'expense_void',
    'payment_rejection',
    'payment_reversal',
    'waiver',
    'no_change'
  )),
  resolution_note text,
  resolved_at timestamptz,
  resolved_by_membership_id uuid references public.household_memberships (id) on delete restrict,
  related_corrective_entity_type text,
  related_corrective_entity_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (expense_id is not null)::int
    + (obligation_id is not null)::int
    + (payment_id is not null)::int
    = 1
  )
);

create index reimbursement_disputes_household_idx
  on public.reimbursement_disputes (household_id, created_at desc);
create index reimbursement_disputes_status_idx
  on public.reimbursement_disputes (household_id, status);

create trigger reimbursement_disputes_set_updated_at
  before update on public.reimbursement_disputes
  for each row execute function public.set_updated_at();

create table public.dispute_events (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.reimbursement_disputes (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete restrict,
  actor_membership_id uuid not null references public.household_memberships (id) on delete restrict,
  event_type text not null check (event_type in (
    'opened', 'status_changed', 'resolved', 'withdrawn', 'comment'
  )),
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now()
);

create index dispute_events_dispute_idx
  on public.dispute_events (dispute_id, created_at);

-- ---------------------------------------------------------------------------
-- Membership / household consistency triggers
-- ---------------------------------------------------------------------------
create or replace function public.enforce_payment_household()
returns trigger
language plpgsql
as $$
begin
  if not public.membership_belongs_to_household(new.sender_membership_id, new.household_id) then
    raise exception 'Sender membership must belong to payment household';
  end if;
  if not public.membership_belongs_to_household(new.recipient_membership_id, new.household_id) then
    raise exception 'Recipient membership must belong to payment household';
  end if;
  if not public.membership_belongs_to_household(new.created_by_membership_id, new.household_id) then
    raise exception 'Creator membership must belong to payment household';
  end if;
  if not exists (
    select 1 from public.households h
    where h.id = new.household_id and h.currency = new.currency
  ) then
    raise exception 'Payment currency must match household currency';
  end if;
  return new;
end;
$$;

create trigger payments_enforce_household
  before insert or update on public.payments
  for each row execute function public.enforce_payment_household();

create or replace function public.enforce_payment_allocation_consistency()
returns trigger
language plpgsql
as $$
declare
  v_payment public.payments%rowtype;
  v_obl public.reimbursement_obligations%rowtype;
begin
  select * into v_payment from public.payments where id = new.payment_id;
  if v_payment.id is null then
    raise exception 'Payment not found for allocation';
  end if;
  if v_payment.household_id is distinct from new.household_id then
    raise exception 'Allocation household must match payment';
  end if;

  select * into v_obl from public.reimbursement_obligations where id = new.obligation_id;
  if v_obl.id is null then
    raise exception 'Obligation not found for allocation';
  end if;
  if v_obl.household_id is distinct from new.household_id then
    raise exception 'Allocation obligation must match household';
  end if;
  if v_obl.debtor_membership_id is distinct from v_payment.sender_membership_id then
    raise exception 'Allocation obligation debtor must be payment sender';
  end if;
  if v_obl.creditor_membership_id is distinct from v_payment.recipient_membership_id then
    raise exception 'Allocation obligation creditor must be payment recipient';
  end if;
  return new;
end;
$$;

create trigger payment_allocations_enforce_consistency
  before insert or update on public.payment_allocations
  for each row execute function public.enforce_payment_allocation_consistency();

-- RPC-only writes for financial settlement tables
create or replace function public.enforce_payment_rpc_only()
returns trigger
language plpgsql
as $$
begin
  if current_setting('householdos.payment_mutation', true) is distinct from 'rpc'
     and current_setting('householdos.expense_mutation', true) is distinct from 'rpc' then
    raise exception 'Payment settlement records may only be written by secure functions';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger payments_rpc_only
  before insert or update or delete on public.payments
  for each row execute function public.enforce_payment_rpc_only();

create trigger payment_private_details_rpc_only
  before insert or update or delete on public.payment_private_details
  for each row execute function public.enforce_payment_rpc_only();

create trigger payment_allocations_rpc_only
  before insert or update or delete on public.payment_allocations
  for each row execute function public.enforce_payment_rpc_only();

create trigger payment_reversals_rpc_only
  before insert or update or delete on public.payment_reversals
  for each row execute function public.enforce_payment_rpc_only();

create trigger reimbursement_waivers_rpc_only
  before insert or update or delete on public.reimbursement_waivers
  for each row execute function public.enforce_payment_rpc_only();

create trigger reimbursement_waiver_reversals_rpc_only
  before insert or update or delete on public.reimbursement_waiver_reversals
  for each row execute function public.enforce_payment_rpc_only();

create trigger reimbursement_disputes_rpc_only
  before insert or update or delete on public.reimbursement_disputes
  for each row execute function public.enforce_payment_rpc_only();

create trigger dispute_events_rpc_only
  before insert or update or delete on public.dispute_events
  for each row execute function public.enforce_payment_rpc_only();
