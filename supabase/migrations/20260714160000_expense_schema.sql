-- Phase 2: expense schema, allocations, reimbursement obligations, amendments

-- ---------------------------------------------------------------------------
-- expenses
-- ---------------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete restrict,
  created_by_membership_id uuid not null references public.household_memberships (id) on delete restrict,
  payer_membership_id uuid not null references public.household_memberships (id) on delete restrict,
  merchant text not null default '' check (char_length(merchant) <= 200),
  description text not null default '' check (char_length(description) <= 2000),
  category text
    check (
      category is null
      or category in (
        'groceries',
        'household',
        'utilities',
        'dining',
        'transport',
        'health',
        'other'
      )
    ),
  purchase_date date not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  declared_total_cents integer not null check (declared_total_cents >= 0),
  calculated_subtotal_cents integer not null default 0 check (calculated_subtotal_cents >= 0),
  calculated_adjustments_cents integer not null default 0,
  status text not null default 'draft'
    check (status in ('draft', 'ready_for_review', 'confirmed', 'amended', 'voided')),
  confirmed_at timestamptz,
  confirmed_by_membership_id uuid references public.household_memberships (id) on delete set null,
  voided_at timestamptz,
  void_reason text,
  supersedes_expense_id uuid references public.expenses (id) on delete restrict,
  superseded_by_expense_id uuid references public.expenses (id) on delete restrict,
  confirmation_idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status <> 'confirmed' and status <> 'amended')
    or (confirmed_at is not null)
  ),
  check (
    status <> 'voided'
    or (voided_at is not null and void_reason is not null and char_length(trim(void_reason)) >= 1)
  ),
  unique (id, household_id)
);

create unique index expenses_confirmation_idempotency_key_uidx
  on public.expenses (id, confirmation_idempotency_key)
  where confirmation_idempotency_key is not null;

create index expenses_household_purchase_date_idx
  on public.expenses (household_id, purchase_date desc);
create index expenses_household_status_idx
  on public.expenses (household_id, status);
create index expenses_payer_membership_id_idx
  on public.expenses (payer_membership_id);
create index expenses_created_by_membership_id_idx
  on public.expenses (created_by_membership_id);

create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- expense_items
-- ---------------------------------------------------------------------------
create table public.expense_items (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete restrict,
  description text not null check (char_length(trim(description)) >= 1),
  quantity_label text,
  total_cents integer not null check (total_cents >= 0),
  display_order integer not null default 0,
  allocation_mode text not null
    check (
      allocation_mode in (
        'personal',
        'equal_all',
        'equal_selected',
        'fixed_cents',
        'percentage',
        'weighted',
        'excluded'
      )
    ),
  personal_membership_id uuid references public.household_memberships (id) on delete restrict,
  exclude_from_adjustment_basis boolean not null default false,
  classification text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  unique (id, expense_id)
);

create index expense_items_expense_id_idx on public.expense_items (expense_id, display_order);

create trigger expense_items_set_updated_at
  before update on public.expense_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- expense_item_allocations (inputs + computed amounts)
-- ---------------------------------------------------------------------------
create table public.expense_item_allocations (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.expense_items (id) on delete cascade,
  expense_id uuid not null references public.expenses (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete restrict,
  membership_id uuid not null references public.household_memberships (id) on delete restrict,
  amount_cents integer not null default 0,
  fixed_cents integer,
  percent_bps integer check (percent_bps is null or percent_bps >= 0),
  weight integer check (weight is null or weight > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id, membership_id)
);

create index expense_item_allocations_expense_id_idx
  on public.expense_item_allocations (expense_id);
create index expense_item_allocations_membership_id_idx
  on public.expense_item_allocations (membership_id);

create trigger expense_item_allocations_set_updated_at
  before update on public.expense_item_allocations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- expense_adjustments
-- ---------------------------------------------------------------------------
create table public.expense_adjustments (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete restrict,
  adjustment_type text not null
    check (
      adjustment_type in (
        'tax',
        'tip',
        'delivery_fee',
        'service_fee',
        'discount',
        'coupon',
        'store_credit',
        'other'
      )
    ),
  description text not null check (char_length(trim(description)) >= 1),
  amount_cents integer not null,
  allocation_mode text not null
    check (
      allocation_mode in (
        'proportional',
        'equal_all',
        'equal_selected',
        'fixed_cents',
        'percentage',
        'weighted',
        'payer_absorbs',
        'assigned'
      )
    ),
  assigned_membership_id uuid references public.household_memberships (id) on delete restrict,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  unique (id, expense_id)
);

create index expense_adjustments_expense_id_idx
  on public.expense_adjustments (expense_id, display_order);

create trigger expense_adjustments_set_updated_at
  before update on public.expense_adjustments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- expense_adjustment_allocations
-- ---------------------------------------------------------------------------
create table public.expense_adjustment_allocations (
  id uuid primary key default gen_random_uuid(),
  adjustment_id uuid not null references public.expense_adjustments (id) on delete cascade,
  expense_id uuid not null references public.expenses (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete restrict,
  membership_id uuid not null references public.household_memberships (id) on delete restrict,
  amount_cents integer not null default 0,
  fixed_cents integer,
  percent_bps integer check (percent_bps is null or percent_bps >= 0),
  weight integer check (weight is null or weight > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (adjustment_id, membership_id)
);

create index expense_adjustment_allocations_expense_id_idx
  on public.expense_adjustment_allocations (expense_id);

create trigger expense_adjustment_allocations_set_updated_at
  before update on public.expense_adjustment_allocations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- reimbursement_obligations
-- ---------------------------------------------------------------------------
create table public.reimbursement_obligations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete restrict,
  expense_id uuid not null references public.expenses (id) on delete restrict,
  creditor_membership_id uuid not null references public.household_memberships (id) on delete restrict,
  debtor_membership_id uuid not null references public.household_memberships (id) on delete restrict,
  original_amount_cents integer not null check (original_amount_cents > 0),
  current_amount_cents integer not null check (current_amount_cents >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'adjusted', 'reversed', 'waived', 'settled')),
  reversed_by_obligation_id uuid references public.reimbursement_obligations (id) on delete set null,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (debtor_membership_id <> creditor_membership_id),
  unique (expense_id, debtor_membership_id, creditor_membership_id)
);

create index reimbursement_obligations_household_id_idx
  on public.reimbursement_obligations (household_id);
create index reimbursement_obligations_debtor_idx
  on public.reimbursement_obligations (debtor_membership_id, status);
create index reimbursement_obligations_creditor_idx
  on public.reimbursement_obligations (creditor_membership_id, status);
create index reimbursement_obligations_expense_id_idx
  on public.reimbursement_obligations (expense_id);

create trigger reimbursement_obligations_set_updated_at
  before update on public.reimbursement_obligations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- expense_amendments
-- ---------------------------------------------------------------------------
create table public.expense_amendments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete restrict,
  original_expense_id uuid not null references public.expenses (id) on delete restrict,
  amendment_expense_id uuid not null references public.expenses (id) on delete restrict,
  reason text not null check (char_length(trim(reason)) >= 1),
  created_by_membership_id uuid not null references public.household_memberships (id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'confirmed', 'cancelled')),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (amendment_expense_id),
  unique (original_expense_id, amendment_expense_id)
);

create index expense_amendments_original_idx on public.expense_amendments (original_expense_id);
create index expense_amendments_household_idx on public.expense_amendments (household_id);

create trigger expense_amendments_set_updated_at
  before update on public.expense_amendments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Household consistency helpers
-- ---------------------------------------------------------------------------
create or replace function public.membership_belongs_to_household(
  p_membership_id uuid,
  p_household_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_memberships m
    where m.id = p_membership_id
      and m.household_id = p_household_id
  );
$$;

revoke all on function public.membership_belongs_to_household(uuid, uuid) from public;
grant execute on function public.membership_belongs_to_household(uuid, uuid) to authenticated;

create or replace function public.enforce_expense_membership_household()
returns trigger
language plpgsql
as $$
begin
  if not public.membership_belongs_to_household(new.created_by_membership_id, new.household_id) then
    raise exception 'Creator membership must belong to expense household';
  end if;
  if not public.membership_belongs_to_household(new.payer_membership_id, new.household_id) then
    raise exception 'Payer membership must belong to expense household';
  end if;
  if new.confirmed_by_membership_id is not null
     and not public.membership_belongs_to_household(new.confirmed_by_membership_id, new.household_id) then
    raise exception 'Confirmed-by membership must belong to expense household';
  end if;

  -- Currency must match household
  if not exists (
    select 1 from public.households h
    where h.id = new.household_id and h.currency = new.currency
  ) then
    raise exception 'Expense currency must match household currency';
  end if;

  return new;
end;
$$;

create trigger expenses_enforce_membership_household
  before insert or update on public.expenses
  for each row execute function public.enforce_expense_membership_household();

create or replace function public.enforce_expense_child_household()
returns trigger
language plpgsql
as $$
declare
  v_expense_household uuid;
begin
  select e.household_id into v_expense_household
  from public.expenses e
  where e.id = new.expense_id;

  if v_expense_household is null then
    raise exception 'Expense not found';
  end if;

  if new.household_id is distinct from v_expense_household then
    raise exception 'Child row household_id must match expense household';
  end if;

  return new;
end;
$$;

create trigger expense_items_enforce_household
  before insert or update on public.expense_items
  for each row execute function public.enforce_expense_child_household();

create trigger expense_adjustments_enforce_household
  before insert or update on public.expense_adjustments
  for each row execute function public.enforce_expense_child_household();

create or replace function public.enforce_allocation_membership_household()
returns trigger
language plpgsql
as $$
begin
  if not public.membership_belongs_to_household(new.membership_id, new.household_id) then
    raise exception 'Allocation membership must belong to expense household';
  end if;
  return new;
end;
$$;

create trigger expense_item_allocations_enforce_membership
  before insert or update on public.expense_item_allocations
  for each row execute function public.enforce_allocation_membership_household();

create trigger expense_adjustment_allocations_enforce_membership
  before insert or update on public.expense_adjustment_allocations
  for each row execute function public.enforce_allocation_membership_household();

create or replace function public.enforce_obligation_household()
returns trigger
language plpgsql
as $$
begin
  if not public.membership_belongs_to_household(new.debtor_membership_id, new.household_id) then
    raise exception 'Debtor membership must belong to obligation household';
  end if;
  if not public.membership_belongs_to_household(new.creditor_membership_id, new.household_id) then
    raise exception 'Creditor membership must belong to obligation household';
  end if;
  if not exists (
    select 1 from public.expenses e
    where e.id = new.expense_id and e.household_id = new.household_id
  ) then
    raise exception 'Obligation expense must belong to same household';
  end if;
  return new;
end;
$$;

create trigger reimbursement_obligations_enforce_household
  before insert or update on public.reimbursement_obligations
  for each row execute function public.enforce_obligation_household();

-- Prevent direct mutation of confirmed/amended/voided expenses via ordinary updates
create or replace function public.enforce_expense_immutability()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.status in ('confirmed', 'amended', 'voided') then
      raise exception 'Confirmed financial records cannot be deleted';
    end if;
    return old;
  end if;

  if old.status in ('confirmed', 'amended', 'voided') then
    -- Allow only security definer RPC changes that set status/supersession fields.
    -- Detect ordinary client attempts: changing mutable draft fields while confirmed.
    if current_setting('householdos.expense_mutation', true) is distinct from 'rpc' then
      raise exception 'Confirmed expenses are immutable; use amendment or void workflows';
    end if;
  end if;

  if tg_op = 'UPDATE'
     and old.status in ('draft', 'ready_for_review')
     and new.status in ('confirmed', 'amended', 'voided')
     and current_setting('householdos.expense_mutation', true) is distinct from 'rpc' then
    raise exception 'Expense confirmation must use confirm_expense RPC';
  end if;

  return new;
end;
$$;

create trigger expenses_enforce_immutability
  before update or delete on public.expenses
  for each row execute function public.enforce_expense_immutability();

create or replace function public.enforce_draft_child_mutability()
returns trigger
language plpgsql
as $$
declare
  v_status text;
  v_expense_id uuid;
begin
  v_expense_id := coalesce(new.expense_id, old.expense_id);
  select e.status into v_status from public.expenses e where e.id = v_expense_id;
  if v_status is null then
    return coalesce(new, old);
  end if;
  if v_status not in ('draft', 'ready_for_review')
     and current_setting('householdos.expense_mutation', true) is distinct from 'rpc' then
    raise exception 'Cannot modify items on a confirmed expense';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger expense_items_draft_only
  before insert or update or delete on public.expense_items
  for each row execute function public.enforce_draft_child_mutability();

create trigger expense_item_allocations_draft_only
  before insert or update or delete on public.expense_item_allocations
  for each row execute function public.enforce_draft_child_mutability();

create trigger expense_adjustments_draft_only
  before insert or update or delete on public.expense_adjustments
  for each row execute function public.enforce_draft_child_mutability();

create trigger expense_adjustment_allocations_draft_only
  before insert or update or delete on public.expense_adjustment_allocations
  for each row execute function public.enforce_draft_child_mutability();

-- Block direct client writes to obligations
create or replace function public.enforce_obligation_rpc_only()
returns trigger
language plpgsql
as $$
begin
  if current_setting('householdos.expense_mutation', true) is distinct from 'rpc' then
    raise exception 'Reimbursement obligations may only be written by secure functions';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger reimbursement_obligations_rpc_only
  before insert or update or delete on public.reimbursement_obligations
  for each row execute function public.enforce_obligation_rpc_only();
