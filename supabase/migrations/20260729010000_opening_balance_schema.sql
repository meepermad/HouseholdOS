-- Completion-B: opening balances (pre-HouseholdOS obligations)
-- Extends reimbursement_obligations; does not fabricate historical expenses.

alter table public.reimbursement_obligations
  drop constraint if exists reimbursement_obligations_obligation_kind_check;

alter table public.reimbursement_obligations
  alter column expense_id drop not null;

alter table public.reimbursement_obligations
  add constraint reimbursement_obligations_obligation_kind_check
  check (obligation_kind in ('reimbursement', 'refund', 'opening_balance'));

alter table public.reimbursement_obligations
  drop constraint if exists reimbursement_obligations_expense_id_debtor_membership_id_creditor_membership_id_key;

create unique index if not exists reimbursement_obligations_expense_pair_uidx
  on public.reimbursement_obligations (expense_id, debtor_membership_id, creditor_membership_id)
  where expense_id is not null;

alter table public.reimbursement_obligations
  add constraint reimbursement_obligations_opening_or_expense_chk
  check (
    (obligation_kind = 'opening_balance' and expense_id is null)
    or (obligation_kind <> 'opening_balance' and expense_id is not null)
  );

create table public.opening_balance_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  debtor_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  creditor_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null check (char_length(currency) = 3),
  effective_date date not null,
  explanation text not null check (char_length(trim(explanation)) between 1 and 2000),
  attachment_storage_path text,
  created_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  status text not null default 'draft' check (status in (
    'draft','awaiting_confirmation','confirmed','rejected','cancelled','reversed'
  )),
  obligation_id uuid references public.reimbursement_obligations(id) on delete set null,
  client_idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (debtor_membership_id <> creditor_membership_id),
  unique (id, household_id),
  unique (client_idempotency_key)
);

create index opening_balance_entries_household_status_idx
  on public.opening_balance_entries(household_id, status, created_at desc);

create table public.opening_balance_approvals (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null,
  household_id uuid not null,
  membership_id uuid not null references public.household_memberships(id) on delete restrict,
  decision text not null check (decision in ('approved','rejected')),
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  foreign key (entry_id, household_id) references public.opening_balance_entries(id, household_id) on delete cascade,
  unique (entry_id, membership_id)
);

create table public.opening_balance_events (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null,
  household_id uuid not null,
  event_type text not null,
  actor_membership_id uuid references public.household_memberships(id) on delete set null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (entry_id, household_id) references public.opening_balance_entries(id, household_id) on delete cascade
);

create table public.opening_balance_import_links (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null,
  household_id uuid not null,
  import_batch_id uuid,
  import_row_id uuid,
  created_at timestamptz not null default now(),
  foreign key (entry_id, household_id) references public.opening_balance_entries(id, household_id) on delete cascade
);

create trigger opening_balance_entries_set_updated_at
  before update on public.opening_balance_entries
  for each row execute function public.set_updated_at();

alter table public.opening_balance_entries enable row level security;
alter table public.opening_balance_approvals enable row level security;
alter table public.opening_balance_events enable row level security;
alter table public.opening_balance_import_links enable row level security;

create policy opening_balance_entries_select on public.opening_balance_entries
  for select to authenticated
  using (
    public.is_active_member(household_id)
    and (
      debtor_membership_id = public.current_membership_id(household_id)
      or creditor_membership_id = public.current_membership_id(household_id)
      or created_by_membership_id = public.current_membership_id(household_id)
      or public._is_financial_coordinator(household_id)
    )
  );

create policy opening_balance_entries_no_write on public.opening_balance_entries
  for all to authenticated using (false) with check (false);

create policy opening_balance_approvals_select on public.opening_balance_approvals
  for select to authenticated
  using (public.is_active_member(household_id));

create policy opening_balance_approvals_no_write on public.opening_balance_approvals
  for all to authenticated using (false) with check (false);

create policy opening_balance_events_select on public.opening_balance_events
  for select to authenticated
  using (public.is_active_member(household_id));

create policy opening_balance_events_no_write on public.opening_balance_events
  for all to authenticated using (false) with check (false);

create policy opening_balance_import_links_select on public.opening_balance_import_links
  for select to authenticated
  using (public.is_active_member(household_id));

create policy opening_balance_import_links_no_write on public.opening_balance_import_links
  for all to authenticated using (false) with check (false);
