-- Completion-B: routed settlement schema (one intermediary)

create table public.routed_settlement_proposals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  payer_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  intermediary_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  recipient_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null check (char_length(currency) = 3),
  source_obligation_ab_id uuid not null references public.reimbursement_obligations(id) on delete restrict,
  source_obligation_bc_id uuid not null references public.reimbursement_obligations(id) on delete restrict,
  balance_snapshot jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  status text not null default 'draft' check (status in (
    'draft','awaiting_intermediary_approval','awaiting_recipient_acceptance',
    'ready_to_pay','submitted','confirmed','rejected','cancelled','expired','stale','reversed'
  )),
  client_idempotency_key text,
  created_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  payment_id uuid references public.payments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    payer_membership_id <> intermediary_membership_id
    and intermediary_membership_id <> recipient_membership_id
    and payer_membership_id <> recipient_membership_id
  ),
  check (source_obligation_ab_id <> source_obligation_bc_id),
  unique (id, household_id),
  unique (client_idempotency_key)
);

create index routed_settlement_proposals_household_status_idx
  on public.routed_settlement_proposals(household_id, status, created_at desc);

create table public.routed_settlement_legs (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null,
  household_id uuid not null,
  leg_kind text not null check (leg_kind in ('a_to_b','b_to_c','a_to_c_external')),
  obligation_id uuid references public.reimbursement_obligations(id) on delete set null,
  amount_cents integer not null check (amount_cents > 0),
  created_at timestamptz not null default now(),
  foreign key (proposal_id, household_id) references public.routed_settlement_proposals(id, household_id) on delete cascade
);

create table public.routed_settlement_approvals (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null,
  household_id uuid not null,
  membership_id uuid not null references public.household_memberships(id) on delete restrict,
  role text not null check (role in ('intermediary','recipient','payer')),
  decision text not null check (decision in ('approved','rejected','accepted')),
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  foreign key (proposal_id, household_id) references public.routed_settlement_proposals(id, household_id) on delete cascade,
  unique (proposal_id, membership_id, role)
);

create table public.routed_settlement_payment_links (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null,
  household_id uuid not null,
  payment_id uuid not null references public.payments(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (proposal_id, household_id) references public.routed_settlement_proposals(id, household_id) on delete cascade,
  unique (proposal_id, payment_id)
);

create table public.routed_settlement_events (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null,
  household_id uuid not null,
  event_type text not null,
  actor_membership_id uuid references public.household_memberships(id) on delete set null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (proposal_id, household_id) references public.routed_settlement_proposals(id, household_id) on delete cascade
);

create table public.routed_settlement_reservations (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null,
  household_id uuid not null,
  obligation_id uuid not null references public.reimbursement_obligations(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'active' check (status in ('active','released','consumed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (proposal_id, household_id) references public.routed_settlement_proposals(id, household_id) on delete cascade
);

create index routed_settlement_reservations_obligation_idx
  on public.routed_settlement_reservations(obligation_id, status)
  where status = 'active';

create trigger routed_settlement_proposals_set_updated_at
  before update on public.routed_settlement_proposals
  for each row execute function public.set_updated_at();

create trigger routed_settlement_reservations_set_updated_at
  before update on public.routed_settlement_reservations
  for each row execute function public.set_updated_at();

alter table public.routed_settlement_proposals enable row level security;
alter table public.routed_settlement_legs enable row level security;
alter table public.routed_settlement_approvals enable row level security;
alter table public.routed_settlement_payment_links enable row level security;
alter table public.routed_settlement_events enable row level security;
alter table public.routed_settlement_reservations enable row level security;

create or replace function public.can_view_routed_settlement(p_proposal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.routed_settlement_proposals p
    where p.id = p_proposal_id
      and public.is_active_member(p.household_id)
      and (
        p.payer_membership_id = public.current_membership_id(p.household_id)
        or p.intermediary_membership_id = public.current_membership_id(p.household_id)
        or p.recipient_membership_id = public.current_membership_id(p.household_id)
        or p.created_by_membership_id = public.current_membership_id(p.household_id)
        or public._is_financial_coordinator(p.household_id)
      )
  );
$$;

revoke all on function public.can_view_routed_settlement(uuid) from public, anon;
grant execute on function public.can_view_routed_settlement(uuid) to authenticated;

create policy routed_settlement_proposals_select on public.routed_settlement_proposals
  for select to authenticated using (public.can_view_routed_settlement(id));
create policy routed_settlement_proposals_no_write on public.routed_settlement_proposals
  for all to authenticated using (false) with check (false);

create policy routed_settlement_legs_select on public.routed_settlement_legs
  for select to authenticated using (public.can_view_routed_settlement(proposal_id));
create policy routed_settlement_legs_no_write on public.routed_settlement_legs
  for all to authenticated using (false) with check (false);

create policy routed_settlement_approvals_select on public.routed_settlement_approvals
  for select to authenticated using (public.can_view_routed_settlement(proposal_id));
create policy routed_settlement_approvals_no_write on public.routed_settlement_approvals
  for all to authenticated using (false) with check (false);

create policy routed_settlement_payment_links_select on public.routed_settlement_payment_links
  for select to authenticated using (public.can_view_routed_settlement(proposal_id));
create policy routed_settlement_payment_links_no_write on public.routed_settlement_payment_links
  for all to authenticated using (false) with check (false);

create policy routed_settlement_events_select on public.routed_settlement_events
  for select to authenticated using (public.can_view_routed_settlement(proposal_id));
create policy routed_settlement_events_no_write on public.routed_settlement_events
  for all to authenticated using (false) with check (false);

create policy routed_settlement_reservations_select on public.routed_settlement_reservations
  for select to authenticated using (public.can_view_routed_settlement(proposal_id));
create policy routed_settlement_reservations_no_write on public.routed_settlement_reservations
  for all to authenticated using (false) with check (false);
