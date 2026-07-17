-- UX-C: polls, utilities, emergency card

create table if not exists public.household_polls (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  created_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  question text not null check (char_length(trim(question)) between 1 and 500),
  allow_multiple boolean not null default false,
  anonymous boolean not null default false,
  deadline_at timestamptz,
  status text not null default 'open' check (status in ('open','closed','cancelled')),
  linked_entity_type text,
  linked_entity_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id)
);

create table if not exists public.household_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  label text not null check (char_length(trim(label)) between 1 and 200),
  sort_order int not null default 0,
  unique (id, household_id),
  foreign key (poll_id, household_id) references public.household_polls(id, household_id) on delete cascade
);

create table if not exists public.household_poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null,
  option_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  membership_id uuid not null references public.household_memberships(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (poll_id, option_id, membership_id),
  foreign key (poll_id, household_id) references public.household_polls(id, household_id) on delete cascade,
  foreign key (option_id, household_id) references public.household_poll_options(id, household_id) on delete cascade
);

create table if not exists public.household_utilities (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 120),
  category text not null default 'other' check (category in (
    'rent','electricity','internet','water','subscription','other'
  )),
  account_owner_membership_id uuid references public.household_memberships(id) on delete set null,
  due_day_of_month int check (due_day_of_month is null or due_day_of_month between 1 and 28),
  recurrence text not null default 'monthly' check (recurrence in ('weekly','monthly','yearly','one_time')),
  estimated_amount_cents int check (estimated_amount_cents is null or estimated_amount_cents >= 0),
  actual_amount_cents int check (actual_amount_cents is null or actual_amount_cents >= 0),
  payment_status text not null default 'upcoming' check (payment_status in (
    'upcoming','due','paid','overdue','skipped'
  )),
  split_policy text not null default 'equal' check (split_policy in ('equal','custom','payer_only')),
  expense_id uuid,
  calendar_event_id uuid,
  reminder_enabled boolean not null default true,
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id)
);

create table if not exists public.household_emergency_cards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  property_address text check (property_address is null or char_length(property_address) <= 500),
  landlord_contact text check (landlord_contact is null or char_length(landlord_contact) <= 300),
  emergency_maintenance_number text check (emergency_maintenance_number is null or char_length(emergency_maintenance_number) <= 100),
  utility_emergency_contacts text check (utility_emergency_contacts is null or char_length(utility_emergency_contacts) <= 1000),
  water_shutoff_location text check (water_shutoff_location is null or char_length(water_shutoff_location) <= 300),
  breaker_panel_location text check (breaker_panel_location is null or char_length(breaker_panel_location) <= 300),
  fire_extinguisher_locations text check (fire_extinguisher_locations is null or char_length(fire_extinguisher_locations) <= 500),
  emergency_meeting_point text check (emergency_meeting_point is null or char_length(emergency_meeting_point) <= 300),
  wifi_details_protected text check (wifi_details_protected is null or char_length(wifi_details_protected) <= 500),
  pet_instructions text check (pet_instructions is null or char_length(pet_instructions) <= 1000),
  other_notes text check (other_notes is null or char_length(other_notes) <= 2000),
  visibility text not null default 'members' check (visibility in ('members','coordinators')),
  updated_by_membership_id uuid references public.household_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id)
);

alter table public.household_polls enable row level security;
alter table public.household_poll_options enable row level security;
alter table public.household_poll_votes enable row level security;
alter table public.household_utilities enable row level security;
alter table public.household_emergency_cards enable row level security;

create policy household_polls_select on public.household_polls
  for select to authenticated using (public.is_active_member(household_id));
create policy household_polls_insert on public.household_polls
  for insert to authenticated
  with check (
    created_by_membership_id = public.current_membership_id(household_id)
    and public.is_active_member(household_id)
  );
create policy household_polls_update on public.household_polls
  for update to authenticated
  using (public.is_active_member(household_id))
  with check (public.is_active_member(household_id));

create policy household_poll_options_select on public.household_poll_options
  for select to authenticated using (public.is_active_member(household_id));
create policy household_poll_options_insert on public.household_poll_options
  for insert to authenticated with check (public.is_active_member(household_id));

create policy household_poll_votes_select on public.household_poll_votes
  for select to authenticated using (public.is_active_member(household_id));
create policy household_poll_votes_insert on public.household_poll_votes
  for insert to authenticated
  with check (
    membership_id = public.current_membership_id(household_id)
    and public.is_active_member(household_id)
  );

create policy household_utilities_all on public.household_utilities
  for all to authenticated
  using (public.is_active_member(household_id))
  with check (public.is_active_member(household_id));

create policy household_emergency_cards_select on public.household_emergency_cards
  for select to authenticated
  using (
    public.is_active_member(household_id)
    and (
      visibility = 'members'
      or public.is_household_coordinator(household_id)
    )
  );
create policy household_emergency_cards_write on public.household_emergency_cards
  for all to authenticated
  using (public.is_household_coordinator(household_id))
  with check (public.is_household_coordinator(household_id));
