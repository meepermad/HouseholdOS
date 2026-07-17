-- Completion-F: four-roommate operations (bounded modules)

create table if not exists public.shared_purchase_proposals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text,
  estimated_amount_cents integer check (estimated_amount_cents is null or estimated_amount_cents >= 0),
  threshold_cents integer check (threshold_cents is null or threshold_cents >= 0),
  ownership_model text not null default 'shared' check (ownership_model in ('shared','personal','split')),
  status text not null default 'proposed' check (status in ('proposed','approved','purchased','rejected','cancelled')),
  created_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  poll_id uuid,
  expense_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id)
);

create table if not exists public.household_meeting_notes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 1 and 200),
  meeting_at timestamptz not null,
  agenda text,
  outcomes text,
  action_items jsonb not null default '[]'::jsonb,
  created_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id)
);

create table if not exists public.household_packages (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  recipient_membership_id uuid references public.household_memberships(id) on delete set null,
  carrier text,
  tracking_private text,
  location_note text,
  photo_storage_path text,
  status text not null default 'arrived' check (status in ('arrived','claimed','returned','cancelled')),
  created_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id)
);

create table if not exists public.household_parking_spots (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  label text not null check (char_length(trim(label)) between 1 and 80),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, household_id),
  unique (household_id, label)
);

create table if not exists public.household_parking_assignments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  spot_id uuid not null,
  membership_id uuid not null references public.household_memberships(id) on delete restrict,
  starts_on date not null default current_date,
  ends_on date,
  created_at timestamptz not null default now(),
  foreign key (spot_id, household_id) references public.household_parking_spots(id, household_id) on delete cascade
);

create table if not exists public.household_directory_contacts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 120),
  role_label text,
  phone text,
  email text,
  notes text,
  created_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.household_retention_policies (
  household_id uuid primary key references public.households(id) on delete cascade,
  receipt_image_retention_days integer check (receipt_image_retention_days is null or receipt_image_retention_days >= 30),
  soft_delete_preview_required boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.households
  add column if not exists parking_module_enabled boolean not null default false;

alter table public.shared_purchase_proposals enable row level security;
alter table public.household_meeting_notes enable row level security;
alter table public.household_packages enable row level security;
alter table public.household_parking_spots enable row level security;
alter table public.household_parking_assignments enable row level security;
alter table public.household_directory_contacts enable row level security;
alter table public.household_retention_policies enable row level security;

create policy shared_purchase_proposals_select on public.shared_purchase_proposals
  for select to authenticated using (public.is_active_member(household_id));
create policy shared_purchase_proposals_insert on public.shared_purchase_proposals
  for insert to authenticated with check (
    public.is_active_member(household_id)
    and created_by_membership_id = public.current_membership_id(household_id)
  );
create policy shared_purchase_proposals_update on public.shared_purchase_proposals
  for update to authenticated using (public.is_active_member(household_id));

create policy household_meeting_notes_select on public.household_meeting_notes
  for select to authenticated using (public.is_active_member(household_id));
create policy household_meeting_notes_insert on public.household_meeting_notes
  for insert to authenticated with check (
    public.is_active_member(household_id)
    and created_by_membership_id = public.current_membership_id(household_id)
  );
create policy household_meeting_notes_update on public.household_meeting_notes
  for update to authenticated using (public.is_active_member(household_id));

create policy household_packages_select on public.household_packages
  for select to authenticated using (public.is_active_member(household_id));
create policy household_packages_insert on public.household_packages
  for insert to authenticated with check (
    public.is_active_member(household_id)
    and created_by_membership_id = public.current_membership_id(household_id)
  );
create policy household_packages_update on public.household_packages
  for update to authenticated using (public.is_active_member(household_id));

create policy household_parking_spots_all on public.household_parking_spots
  for all to authenticated
  using (public.is_active_member(household_id))
  with check (public.is_active_member(household_id));

create policy household_parking_assignments_all on public.household_parking_assignments
  for all to authenticated
  using (public.is_active_member(household_id))
  with check (public.is_active_member(household_id));

create policy household_directory_contacts_all on public.household_directory_contacts
  for all to authenticated
  using (public.is_active_member(household_id))
  with check (public.is_active_member(household_id));

create policy household_retention_policies_select on public.household_retention_policies
  for select to authenticated using (public.is_active_member(household_id));
create policy household_retention_policies_write on public.household_retention_policies
  for all to authenticated
  using (public._is_financial_coordinator(household_id))
  with check (public._is_financial_coordinator(household_id));
