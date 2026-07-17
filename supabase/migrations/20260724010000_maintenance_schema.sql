-- Phase 7B: maintenance / repair coordination schema

create table public.maintenance_external_contacts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  display_name text not null check (char_length(trim(display_name)) between 1 and 200),
  organization text check (organization is null or char_length(organization) <= 200),
  contact_type text not null check (contact_type in (
    'landlord','property_manager','maintenance_company','plumber','electrician',
    'hvac_company','appliance_repair','pest_control','utility','internet_provider','other'
  )),
  phone text check (phone is null or char_length(phone) <= 40),
  email text check (email is null or char_length(email) <= 320),
  website text check (website is null or char_length(website) <= 2000),
  notes text check (notes is null or char_length(notes) <= 2000),
  service_categories text[] not null default '{}',
  preferred boolean not null default false,
  last_contacted_at timestamptz,
  active boolean not null default true,
  created_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id)
);

create table public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text check (description is null or char_length(description) <= 8000),
  category text not null check (category in (
    'plumbing','electrical','hvac','appliance','structural','water_damage','pest',
    'safety','security','internet_technology','furniture','cleaning_damage','outdoor','utility','other'
  )),
  severity text not null default 'normal' check (severity in (
    'low','normal','high','urgent','emergency_guidance'
  )),
  status text not null default 'reported' check (status in (
    'reported','triaged','assigned','waiting_on_household','waiting_on_landlord',
    'waiting_on_vendor','appointment_scheduled','in_progress','resolved','closed','reopened','cancelled'
  )),
  visibility text not null default 'household' check (visibility in (
    'household','participants','coordinators'
  )),
  location_id uuid,
  inventory_item_id uuid,
  first_noticed_at date,
  currently_active boolean not null default true,
  stop_use boolean not null default false,
  immediate_mitigation text check (immediate_mitigation is null or char_length(immediate_mitigation) <= 4000),
  hazard_flags text[] not null default '{}',
  reporter_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  primary_coordinator_membership_id uuid references public.household_memberships(id) on delete restrict,
  suggested_coordinator_membership_id uuid references public.household_memberships(id) on delete restrict,
  responsibility_area_id uuid,
  landlord_involvement boolean not null default false,
  landlord_workflow_status text check (landlord_workflow_status is null or landlord_workflow_status in (
    'drafting_report','submitted_externally','acknowledged','scheduled','completed','disputed','no_response'
  )),
  decision_outcome text check (decision_outcome is null or decision_outcome in (
    'repair','replace','monitor','dispose','return','warranty_claim','landlord_action','no_action'
  )),
  estimated_cost_cents integer check (estimated_cost_cents is null or estimated_cost_cents >= 0),
  quoted_cost_cents integer check (quoted_cost_cents is null or quoted_cost_cents >= 0),
  linked_as_recurrence_of uuid,
  resolved_at timestamptz,
  closed_at timestamptz,
  cancelled_at timestamptz,
  resolution_notes text check (resolution_notes is null or char_length(resolution_notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  foreign key (location_id, household_id) references public.household_locations(id, household_id) on delete set null,
  foreign key (inventory_item_id, household_id) references public.inventory_items(id, household_id) on delete set null,
  foreign key (responsibility_area_id, household_id) references public.responsibility_areas(id, household_id) on delete set null,
  foreign key (linked_as_recurrence_of, household_id) references public.maintenance_requests(id, household_id) on delete set null
);

create index maintenance_requests_household_status_idx
  on public.maintenance_requests(household_id, status, severity, created_at desc);
create index maintenance_requests_household_location_idx
  on public.maintenance_requests(household_id, location_id) where location_id is not null;

create table public.maintenance_request_participants (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  membership_id uuid not null references public.household_memberships(id) on delete restrict,
  role text not null default 'collaborator' check (role in ('collaborator','affected','observer')),
  created_at timestamptz not null default now(),
  unique (request_id, membership_id),
  foreign key (request_id, household_id) references public.maintenance_requests(id, household_id) on delete cascade
);

create table public.maintenance_assignments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  membership_id uuid not null references public.household_memberships(id) on delete restrict,
  is_primary boolean not null default false,
  assigned_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz,
  unique (request_id, membership_id),
  foreign key (request_id, household_id) references public.maintenance_requests(id, household_id) on delete cascade
);

create table public.maintenance_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  event_type text not null check (event_type in (
    'reported','triaged','severity_changed','assigned','unassigned','comment_added',
    'mitigation_recorded','contact_attempted','external_reference_added',
    'appointment_scheduled','appointment_changed','appointment_cancelled',
    'work_started','work_completed','condition_changed','expense_linked',
    'waiting_status_changed','resolved','closed','reopened','cancelled',
    'evidence_added','evidence_removed'
  )),
  actor_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  body text check (body is null or char_length(body) <= 4000),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (request_id, household_id) references public.maintenance_requests(id, household_id) on delete cascade
);

create index maintenance_events_request_idx
  on public.maintenance_events(request_id, created_at);

create table public.maintenance_actions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text check (description is null or char_length(description) <= 2000),
  status text not null default 'open' check (status in ('open','in_progress','done','cancelled')),
  assignee_membership_id uuid references public.household_memberships(id) on delete restrict,
  created_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, household_id),
  foreign key (request_id, household_id) references public.maintenance_requests(id, household_id) on delete cascade
);

create table public.maintenance_chore_links (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  chore_occurrence_id uuid,
  chore_definition_id uuid,
  created_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  unlinked_at timestamptz,
  foreign key (request_id, household_id) references public.maintenance_requests(id, household_id) on delete cascade,
  foreign key (chore_occurrence_id, household_id) references public.chore_occurrences(id, household_id) on delete cascade,
  foreign key (chore_definition_id, household_id) references public.chore_definitions(id, household_id) on delete cascade
);

create table public.maintenance_calendar_links (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  calendar_event_id uuid not null,
  appointment_kind text not null default 'vendor_visit' check (appointment_kind in (
    'exact','service_window','inspection','follow_up','access_needed',
    'vendor_visit','landlord_visit','utility_visit'
  )),
  created_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  unique (calendar_event_id),
  foreign key (request_id, household_id) references public.maintenance_requests(id, household_id) on delete cascade,
  foreign key (calendar_event_id) references public.calendar_events(id) on delete cascade
);

create table public.maintenance_expense_links (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  expense_id uuid not null,
  expense_item_id uuid,
  link_kind text not null default 'repair' check (link_kind in (
    'diagnostic','repair','replacement','supplies','vendor_invoice','landlord_reimbursable','other'
  )),
  created_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  unlinked_at timestamptz,
  foreign key (request_id, household_id) references public.maintenance_requests(id, household_id) on delete cascade,
  foreign key (expense_id, household_id) references public.expenses(id, household_id) on delete restrict
);

create table public.maintenance_inventory_links (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  inventory_item_id uuid not null,
  created_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  unlinked_at timestamptz,
  unique (request_id, inventory_item_id),
  foreign key (request_id, household_id) references public.maintenance_requests(id, household_id) on delete cascade,
  foreign key (inventory_item_id, household_id) references public.inventory_items(id, household_id) on delete cascade
);

create table public.maintenance_contact_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  contact_id uuid not null,
  event_kind text not null check (event_kind in (
    'attempt','response','reference','appointment_offered','quote','follow_up'
  )),
  reference_number text check (reference_number is null or char_length(reference_number) <= 120),
  notes text check (notes is null or char_length(notes) <= 2000),
  follow_up_at timestamptz,
  recorded_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (request_id, household_id) references public.maintenance_requests(id, household_id) on delete cascade,
  foreign key (contact_id, household_id) references public.maintenance_external_contacts(id, household_id) on delete cascade
);

create table public.maintenance_quotes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  contact_id uuid,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'USD',
  status text not null default 'received' check (status in (
    'draft','received','accepted','declined','expired'
  )),
  expires_at timestamptz,
  notes text check (notes is null or char_length(notes) <= 2000),
  recorded_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (request_id, household_id) references public.maintenance_requests(id, household_id) on delete cascade,
  foreign key (contact_id, household_id) references public.maintenance_external_contacts(id, household_id) on delete set null
);

create table public.maintenance_warranty_claims (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  inventory_item_id uuid,
  claim_reference text check (claim_reference is null or char_length(claim_reference) <= 120),
  status text not null default 'open' check (status in ('open','submitted','approved','denied','closed')),
  notes text check (notes is null or char_length(notes) <= 2000),
  follow_up_at timestamptz,
  recorded_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (request_id, household_id) references public.maintenance_requests(id, household_id) on delete cascade,
  foreign key (inventory_item_id, household_id) references public.inventory_items(id, household_id) on delete set null
);

create table public.maintenance_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  storage_path text not null check (char_length(storage_path) between 1 and 1000),
  mime_type text not null check (mime_type in (
    'image/jpeg','image/png','image/webp','application/pdf'
  )),
  file_name text not null check (char_length(trim(file_name)) between 1 and 260),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 8388608),
  uploaded_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (request_id, household_id) references public.maintenance_requests(id, household_id) on delete cascade
);

create index maintenance_attachments_request_idx
  on public.maintenance_attachments(request_id) where deleted_at is null;

create or replace function public.enforce_maintenance_rpc_only()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null
     and current_setting('householdos.maintenance_mutation', true) is distinct from 'rpc'
     and current_setting('householdos.privileged_mutation', true) is distinct from 'on' then
    raise exception 'Maintenance records may only be written by secure functions';
  end if;
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'maintenance_external_contacts','maintenance_requests','maintenance_request_participants',
    'maintenance_assignments','maintenance_events','maintenance_actions','maintenance_chore_links',
    'maintenance_calendar_links','maintenance_expense_links','maintenance_inventory_links',
    'maintenance_contact_events','maintenance_quotes','maintenance_warranty_claims',
    'maintenance_attachments'
  ]
  loop
    execute format(
      'create trigger %I_rpc_only before insert or update or delete on public.%I
       for each row execute function public.enforce_maintenance_rpc_only()',
      t, t
    );
  end loop;
end $$;

create trigger maintenance_requests_set_updated_at before update on public.maintenance_requests
  for each row execute function public.set_updated_at();
create trigger maintenance_external_contacts_set_updated_at before update on public.maintenance_external_contacts
  for each row execute function public.set_updated_at();
