-- UX-B: roommate coordination — away status, guest notices, chore coverage offers, polls prep tables used by UX-C later stay separate.

-- Membership away / temporary availability (no GPS)
create table if not exists public.membership_away_status (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  membership_id uuid not null references public.household_memberships(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  note text check (note is null or char_length(note) <= 500),
  unavailable_for_chores boolean not null default true,
  exclude_from_meal_headcounts boolean not null default true,
  still_participates_in_expenses boolean not null default true,
  reduce_nonurgent_notifications boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  check (ends_at > starts_at)
);

create index membership_away_status_member_idx
  on public.membership_away_status(membership_id, starts_at, ends_at);
create index membership_away_status_household_idx
  on public.membership_away_status(household_id, ends_at);

-- Guest notices (lightweight coordination; guests need no accounts)
create table if not exists public.guest_notices (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  host_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  calendar_event_id uuid,
  visit_date date not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  overnight boolean not null default false,
  guest_count integer not null default 1 check (guest_count between 1 and 50),
  shared_spaces text check (shared_spaces is null or char_length(shared_spaces) <= 1000),
  parking_needed boolean not null default false,
  meal_participation boolean not null default false,
  quiet_hours_exception boolean not null default false,
  note text check (note is null or char_length(note) <= 2000),
  acknowledgment_requested boolean not null default false,
  status text not null default 'active' check (status in ('active','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  check (ends_at > starts_at)
);

create index guest_notices_household_date_idx
  on public.guest_notices(household_id, visit_date);

-- Chore coverage / swap offers (complements reassignment requests)
create table if not exists public.chore_coverage_offers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  occurrence_id uuid not null,
  offered_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  offered_to_membership_id uuid references public.household_memberships(id) on delete restrict,
  kind text not null check (kind in ('swap_request','offer','cover','temporary_unavailability')),
  note text check (note is null or char_length(note) <= 2000),
  status text not null default 'pending' check (status in ('pending','accepted','declined','withdrawn','expired')),
  resolved_by_membership_id uuid references public.household_memberships(id) on delete restrict,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  foreign key (occurrence_id, household_id) references public.chore_occurrences(id, household_id) on delete cascade,
  check (
    (status = 'pending' and resolved_at is null and resolved_by_membership_id is null)
    or (status <> 'pending' and resolved_at is not null)
  )
);

create index chore_coverage_offers_occurrence_idx
  on public.chore_coverage_offers(occurrence_id, status);
create index chore_coverage_offers_household_idx
  on public.chore_coverage_offers(household_id, status);

-- Weekly review share tokens (optional in-household share of a generated snapshot)
create table if not exists public.household_weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  week_start date not null,
  created_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (household_id, week_start)
);

create index household_weekly_reviews_household_idx
  on public.household_weekly_reviews(household_id, week_start desc);

alter table public.membership_away_status enable row level security;
alter table public.guest_notices enable row level security;
alter table public.chore_coverage_offers enable row level security;
alter table public.household_weekly_reviews enable row level security;
