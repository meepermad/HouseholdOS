-- Phase 9: calendar expansion schema (additive on Phase 4)
-- household calendars, RSVP reconfirm, availability, conflicts, resources,
-- external sync, feed purpose/scope, attachments bucket

-- ---------------------------------------------------------------------------
-- household_calendars
-- ---------------------------------------------------------------------------
create table public.household_calendars (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete restrict,
  name text not null check (char_length(trim(name)) >= 1 and char_length(name) <= 120),
  calendar_type text not null check (calendar_type in (
    'household',
    'personal',
    'subgroup',
    'domain',
    'external_readonly',
    'external_writable'
  )),
  visibility_default text not null default 'household' check (visibility_default in (
    'household',
    'participants',
    'private_busy'
  )),
  owner_membership_id uuid references public.household_memberships (id) on delete restrict,
  domain_source text check (domain_source is null or char_length(domain_source) <= 64),
  color_token text check (color_token is null or char_length(color_token) <= 32),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  check (
    (calendar_type = 'personal' and owner_membership_id is not null)
    or (calendar_type <> 'personal')
  )
);

create index household_calendars_household_idx
  on public.household_calendars (household_id, calendar_type)
  where is_archived = false;

create trigger household_calendars_set_updated_at
  before update on public.household_calendars
  for each row execute function public.set_updated_at();

comment on table public.household_calendars is
  'Named calendars within a household (household, personal, domain, external).';

-- ---------------------------------------------------------------------------
-- household_calendar_memberships
-- ---------------------------------------------------------------------------
create table public.household_calendar_memberships (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.household_calendars (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete restrict,
  membership_id uuid not null references public.household_memberships (id) on delete cascade,
  access_role text not null default 'viewer' check (access_role in (
    'owner',
    'editor',
    'viewer'
  )),
  created_at timestamptz not null default now(),
  unique (calendar_id, membership_id),
  foreign key (calendar_id, household_id)
    references public.household_calendars (id, household_id) on delete cascade
);

create index household_calendar_memberships_member_idx
  on public.household_calendar_memberships (membership_id, calendar_id);

-- ---------------------------------------------------------------------------
-- Attach calendar_id to calendar_events (nullable during backfill)
-- ---------------------------------------------------------------------------
alter table public.calendar_events
  add column if not exists calendar_id uuid,
  add column if not exists meeting_url text
    check (meeting_url is null or char_length(meeting_url) <= 2000),
  add column if not exists busy_status text not null default 'busy'
    check (busy_status in ('busy', 'free', 'tentative')),
  add column if not exists draft_status text not null default 'scheduled'
    check (draft_status in ('draft', 'scheduled', 'cancelled', 'completed')),
  add column if not exists travel_buffer_minutes integer not null default 0
    check (travel_buffer_minutes >= 0 and travel_buffer_minutes <= 240),
  add column if not exists source_system text
    check (source_system is null or char_length(source_system) <= 64),
  add column if not exists source_version text
    check (source_version is null or char_length(source_version) <= 128),
  add column if not exists lifecycle_owner text not null default 'householdos'
    check (lifecycle_owner in ('householdos', 'domain', 'external')),
  add column if not exists is_editable boolean not null default true,
  add column if not exists is_deletable boolean not null default true,
  add column if not exists canonical_deep_link text
    check (canonical_deep_link is null or char_length(canonical_deep_link) <= 500);

-- Expand status to include draft/completed via draft_status; keep status for cancel compat.
-- Expand category for meal_prep if missing (meals migration may already have altered).
do $$
begin
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_name like '%calendar_events_category%'
  ) then
    null;
  end if;
end $$;

-- RSVP reconfirmation columns
alter table public.calendar_event_attendees
  add column if not exists response_note text
    check (response_note is null or char_length(response_note) <= 500),
  add column if not exists response_event_sequence integer not null default 0
    check (response_event_sequence >= 0),
  add column if not exists needs_reconfirmation boolean not null default false,
  add column if not exists is_required boolean not null default true;

create index if not exists calendar_event_attendees_pending_rsvp_idx
  on public.calendar_event_attendees (membership_id, rsvp_status, needs_reconfirmation)
  where rsvp_status = 'needs_action' or needs_reconfirmation = true;

-- Feed token purpose + calendar scope
alter table public.calendar_feed_tokens
  add column if not exists purpose text not null default 'personal_ics'
    check (purpose in ('personal_ics', 'lifeos', 'export')),
  add column if not exists calendar_ids uuid[] not null default '{}'::uuid[],
  add column if not exists include_private boolean not null default false;

-- ---------------------------------------------------------------------------
-- Backfill household + personal calendars, then attach events
-- ---------------------------------------------------------------------------
insert into public.household_calendars (household_id, name, calendar_type, visibility_default)
select h.id, 'Household', 'household', 'household'
from public.households h
where not exists (
  select 1 from public.household_calendars c
  where c.household_id = h.id and c.calendar_type = 'household' and c.is_archived = false
);

insert into public.household_calendars (
  household_id, name, calendar_type, visibility_default, owner_membership_id
)
select
  m.household_id,
  coalesce(nullif(trim(p.display_name), ''), 'Personal') || ' calendar',
  'personal',
  'private_busy',
  m.id
from public.household_memberships m
join public.profiles p on p.id = m.user_id
where m.status = 'active'
  and not exists (
    select 1 from public.household_calendars c
    where c.household_id = m.household_id
      and c.calendar_type = 'personal'
      and c.owner_membership_id = m.id
      and c.is_archived = false
  );

-- Grant calendar memberships
insert into public.household_calendar_memberships (calendar_id, household_id, membership_id, access_role)
select c.id, c.household_id, m.id,
  case when c.calendar_type = 'personal' and c.owner_membership_id = m.id then 'owner' else 'viewer' end
from public.household_calendars c
join public.household_memberships m
  on m.household_id = c.household_id and m.status = 'active'
where c.calendar_type = 'household'
  and not exists (
    select 1 from public.household_calendar_memberships cm
    where cm.calendar_id = c.id and cm.membership_id = m.id
  );

insert into public.household_calendar_memberships (calendar_id, household_id, membership_id, access_role)
select c.id, c.household_id, c.owner_membership_id, 'owner'
from public.household_calendars c
where c.calendar_type = 'personal'
  and c.owner_membership_id is not null
  and not exists (
    select 1 from public.household_calendar_memberships cm
    where cm.calendar_id = c.id and cm.membership_id = c.owner_membership_id
  );

-- Attach existing events to household calendar (personal if private_busy + personal category)
-- Privileged path: domain guards block direct updates to chore/meal-linked rows.
select set_config('householdos.privileged_mutation', 'on', true);
select set_config('householdos.calendar_mutation', 'rpc', true);

update public.calendar_events e
set calendar_id = c.id
from public.household_calendars c
where e.calendar_id is null
  and c.household_id = e.household_id
  and c.calendar_type = 'household'
  and c.is_archived = false
  and e.visibility <> 'private_busy';

update public.calendar_events e
set calendar_id = c.id
from public.household_calendars c
where e.calendar_id is null
  and c.household_id = e.household_id
  and c.calendar_type = 'personal'
  and c.owner_membership_id = e.organizer_membership_id
  and c.is_archived = false;

-- Any remaining → household calendar
update public.calendar_events e
set calendar_id = c.id
from public.household_calendars c
where e.calendar_id is null
  and c.household_id = e.household_id
  and c.calendar_type = 'household'
  and c.is_archived = false;

select set_config('householdos.privileged_mutation', 'off', true);

alter table public.calendar_events
  alter column calendar_id set not null;

alter table public.calendar_events
  drop constraint if exists calendar_events_calendar_id_fkey;

alter table public.calendar_events
  add constraint calendar_events_calendar_id_fkey
  foreign key (calendar_id, household_id)
  references public.household_calendars (id, household_id)
  on delete restrict;

create index if not exists calendar_events_calendar_idx
  on public.calendar_events (calendar_id, status);

create index if not exists calendar_events_source_uniq_idx
  on public.calendar_events (household_id, source_type, source_id)
  where source_type is not null and source_id is not null and status = 'scheduled';

-- ---------------------------------------------------------------------------
-- calendar_availability_rules / overrides
-- ---------------------------------------------------------------------------
create table public.calendar_availability_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete restrict,
  membership_id uuid not null references public.household_memberships (id) on delete cascade,
  rule_kind text not null check (rule_kind in (
    'available',
    'preferred',
    'unavailable',
    'busy_only'
  )),
  weekdays smallint[] not null default '{1,2,3,4,5,6,7}'::smallint[],
  start_minute smallint not null check (start_minute >= 0 and start_minute < 1440),
  end_minute smallint not null check (end_minute > 0 and end_minute <= 1440),
  time_zone text not null default 'America/Chicago',
  calendar_ids uuid[] not null default '{}'::uuid[],
  min_notice_minutes integer not null default 0
    check (min_notice_minutes >= 0 and min_notice_minutes <= 10080),
  max_event_minutes integer
    check (max_event_minutes is null or (max_event_minutes >= 15 and max_event_minutes <= 10080)),
  priority integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_minute > start_minute),
  check (cardinality(weekdays) >= 1 and cardinality(weekdays) <= 7)
);

create index calendar_availability_rules_member_idx
  on public.calendar_availability_rules (membership_id, is_active);

create trigger calendar_availability_rules_set_updated_at
  before update on public.calendar_availability_rules
  for each row execute function public.set_updated_at();

create table public.calendar_availability_overrides (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete restrict,
  membership_id uuid not null references public.household_memberships (id) on delete cascade,
  override_kind text not null check (override_kind in (
    'available',
    'unavailable',
    'private_block'
  )),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  note text check (note is null or char_length(note) <= 240),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index calendar_availability_overrides_range_idx
  on public.calendar_availability_overrides (membership_id, starts_at, ends_at);

-- ---------------------------------------------------------------------------
-- calendar_event_conflicts
-- ---------------------------------------------------------------------------
create table public.calendar_event_conflicts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete restrict,
  event_id uuid not null references public.calendar_events (id) on delete cascade,
  conflicting_event_id uuid references public.calendar_events (id) on delete cascade,
  resource_id uuid,
  conflict_class text not null check (conflict_class in (
    'hard',
    'possible',
    'informational'
  )),
  conflict_kind text not null check (conflict_kind in (
    'participant_overlap',
    'travel_buffer',
    'resource_exclusive',
    'resource_capacity',
    'duplicate_import',
    'recurrence_collision',
    'external_mapping'
  )),
  summary text not null check (char_length(trim(summary)) >= 1 and char_length(summary) <= 240),
  is_resolved boolean not null default false,
  resolved_at timestamptz,
  resolved_by_membership_id uuid references public.household_memberships (id) on delete restrict,
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 500),
  created_at timestamptz not null default now(),
  unique (event_id, conflicting_event_id, conflict_kind),
  foreign key (event_id, household_id)
    references public.calendar_events (id, household_id) on delete cascade
);

create index calendar_event_conflicts_open_idx
  on public.calendar_event_conflicts (household_id, is_resolved, conflict_class)
  where is_resolved = false;

-- ---------------------------------------------------------------------------
-- Bookable calendar resources (distinct from inventory)
-- ---------------------------------------------------------------------------
create table public.calendar_resources (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete restrict,
  name text not null check (char_length(trim(name)) >= 1 and char_length(name) <= 120),
  resource_kind text not null default 'generic' check (resource_kind in (
    'vehicle',
    'kitchen',
    'living_room',
    'guest_room',
    'laundry',
    'parking',
    'equipment',
    'generic'
  )),
  capacity_mode text not null default 'exclusive' check (capacity_mode in (
    'exclusive',
    'capacity'
  )),
  capacity integer not null default 1 check (capacity >= 1 and capacity <= 100),
  is_active boolean not null default true,
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  unique (household_id, name)
);

create trigger calendar_resources_set_updated_at
  before update on public.calendar_resources
  for each row execute function public.set_updated_at();

create table public.calendar_resource_reservations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete restrict,
  resource_id uuid not null references public.calendar_resources (id) on delete cascade,
  event_id uuid not null references public.calendar_events (id) on delete cascade,
  quantity integer not null default 1 check (quantity >= 1 and quantity <= 100),
  confirmed boolean not null default false,
  created_by_membership_id uuid not null references public.household_memberships (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (resource_id, event_id),
  foreign key (resource_id, household_id)
    references public.calendar_resources (id, household_id) on delete cascade,
  foreign key (event_id, household_id)
    references public.calendar_events (id, household_id) on delete cascade
);

alter table public.calendar_event_conflicts
  add constraint calendar_event_conflicts_resource_fkey
  foreign key (resource_id, household_id)
  references public.calendar_resources (id, household_id)
  on delete cascade;

-- ---------------------------------------------------------------------------
-- External sync
-- ---------------------------------------------------------------------------
create table public.calendar_external_connections (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete restrict,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('google', 'ics_import', 'lifeos')),
  account_email text check (account_email is null or char_length(account_email) <= 320),
  -- Sealed refresh token (app-level encryption); never returned to clients
  refresh_token_ciphertext text,
  refresh_token_nonce text,
  access_token_expires_at timestamptz,
  scopes text[] not null default '{}'::text[],
  sync_mode text not null default 'import_only' check (sync_mode in (
    'import_only',
    'export_only',
    'two_way'
  )),
  status text not null default 'active' check (status in (
    'active',
    'needs_reauth',
    'revoked',
    'error'
  )),
  last_sync_at timestamptz,
  last_error_code text check (last_error_code is null or char_length(last_error_code) <= 64),
  last_error_message text check (last_error_message is null or char_length(last_error_message) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (id, household_id),
  unique (owner_user_id, household_id, provider, account_email)
);

create trigger calendar_external_connections_set_updated_at
  before update on public.calendar_external_connections
  for each row execute function public.set_updated_at();

create index calendar_external_connections_owner_idx
  on public.calendar_external_connections (owner_user_id, status);

create table public.calendar_external_calendars (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.calendar_external_connections (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete restrict,
  provider_calendar_id text not null check (char_length(provider_calendar_id) <= 512),
  display_name text not null check (char_length(trim(display_name)) >= 1 and char_length(display_name) <= 200),
  household_calendar_id uuid references public.household_calendars (id) on delete set null,
  sync_direction text not null default 'import' check (sync_direction in (
    'import',
    'export',
    'two_way'
  )),
  is_selected boolean not null default false,
  provider_sync_token text,
  provider_etag text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (connection_id, provider_calendar_id),
  foreign key (connection_id, household_id)
    references public.calendar_external_connections (id, household_id) on delete cascade
);

create table public.calendar_external_event_mappings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete restrict,
  connection_id uuid not null references public.calendar_external_connections (id) on delete cascade,
  external_calendar_id uuid not null references public.calendar_external_calendars (id) on delete cascade,
  event_id uuid not null references public.calendar_events (id) on delete cascade,
  provider_event_id text not null check (char_length(provider_event_id) <= 512),
  provider_etag text,
  local_version integer not null default 0,
  provider_version text,
  last_synced_local_version integer,
  last_synced_provider_version text,
  conflict_type text check (conflict_type is null or conflict_type in (
    'provider_only',
    'local_only',
    'both_changed',
    'provider_deleted_local_changed',
    'local_deleted_provider_changed',
    'duplicate'
  )),
  conflict_resolution text check (conflict_resolution is null or conflict_resolution in (
    'pending',
    'keep_local',
    'keep_provider',
    'merged',
    'dismissed'
  )),
  resolved_by_user_id uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, provider_event_id),
  unique (event_id, connection_id)
);

create trigger calendar_external_event_mappings_set_updated_at
  before update on public.calendar_external_event_mappings
  for each row execute function public.set_updated_at();

create table public.calendar_sync_runs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.calendar_external_connections (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete restrict,
  trigger_kind text not null check (trigger_kind in ('manual', 'scheduled', 'webhook')),
  status text not null default 'queued' check (status in (
    'queued',
    'running',
    'succeeded',
    'partial',
    'failed',
    'dead_letter'
  )),
  claimed_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz,
  events_imported integer not null default 0,
  events_exported integer not null default 0,
  events_conflicted integer not null default 0,
  error_summary text check (error_summary is null or char_length(error_summary) <= 500),
  created_at timestamptz not null default now()
);

create index calendar_sync_runs_claim_idx
  on public.calendar_sync_runs (status, next_attempt_at, created_at)
  where status in ('queued', 'failed');

create table public.calendar_sync_failures (
  id uuid primary key default gen_random_uuid(),
  sync_run_id uuid not null references public.calendar_sync_runs (id) on delete cascade,
  connection_id uuid not null references public.calendar_external_connections (id) on delete cascade,
  failure_code text not null check (char_length(failure_code) <= 64),
  failure_message text not null check (char_length(failure_message) <= 500),
  provider_event_id text,
  is_retryable boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Event links (attachments / related records) + ICS import UIDs
-- ---------------------------------------------------------------------------
create table public.calendar_event_links (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete restrict,
  event_id uuid not null references public.calendar_events (id) on delete cascade,
  link_kind text not null check (link_kind in (
    'attachment',
    'related_record',
    'external_url'
  )),
  label text check (label is null or char_length(label) <= 200),
  storage_path text check (storage_path is null or char_length(storage_path) <= 1000),
  external_url text check (external_url is null or char_length(external_url) <= 2000),
  related_table text check (related_table is null or char_length(related_table) <= 64),
  related_id uuid,
  created_by_membership_id uuid not null references public.household_memberships (id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (event_id, household_id)
    references public.calendar_events (id, household_id) on delete cascade,
  check (
    (link_kind = 'attachment' and storage_path is not null)
    or (link_kind = 'external_url' and external_url is not null)
    or (link_kind = 'related_record' and related_table is not null and related_id is not null)
  )
);

create table public.calendar_ics_import_uids (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete restrict,
  calendar_id uuid not null references public.household_calendars (id) on delete cascade,
  ics_uid text not null check (char_length(ics_uid) <= 512),
  event_id uuid not null references public.calendar_events (id) on delete cascade,
  imported_at timestamptz not null default now(),
  unique (household_id, calendar_id, ics_uid)
);

-- ---------------------------------------------------------------------------
-- RPC-only triggers for new tables
-- ---------------------------------------------------------------------------
create trigger household_calendars_rpc_only
  before insert or update or delete on public.household_calendars
  for each row execute function public.enforce_calendar_rpc_only();

create trigger household_calendar_memberships_rpc_only
  before insert or update or delete on public.household_calendar_memberships
  for each row execute function public.enforce_calendar_rpc_only();

create trigger calendar_availability_rules_rpc_only
  before insert or update or delete on public.calendar_availability_rules
  for each row execute function public.enforce_calendar_rpc_only();

create trigger calendar_availability_overrides_rpc_only
  before insert or update or delete on public.calendar_availability_overrides
  for each row execute function public.enforce_calendar_rpc_only();

create trigger calendar_event_conflicts_rpc_only
  before insert or update or delete on public.calendar_event_conflicts
  for each row execute function public.enforce_calendar_rpc_only();

create trigger calendar_resources_rpc_only
  before insert or update or delete on public.calendar_resources
  for each row execute function public.enforce_calendar_rpc_only();

create trigger calendar_resource_reservations_rpc_only
  before insert or update or delete on public.calendar_resource_reservations
  for each row execute function public.enforce_calendar_rpc_only();

create trigger calendar_external_connections_rpc_only
  before insert or update or delete on public.calendar_external_connections
  for each row execute function public.enforce_calendar_rpc_only();

create trigger calendar_external_calendars_rpc_only
  before insert or update or delete on public.calendar_external_calendars
  for each row execute function public.enforce_calendar_rpc_only();

create trigger calendar_external_event_mappings_rpc_only
  before insert or update or delete on public.calendar_external_event_mappings
  for each row execute function public.enforce_calendar_rpc_only();

create trigger calendar_sync_runs_rpc_only
  before insert or update or delete on public.calendar_sync_runs
  for each row execute function public.enforce_calendar_rpc_only();

create trigger calendar_sync_failures_rpc_only
  before insert or update or delete on public.calendar_sync_failures
  for each row execute function public.enforce_calendar_rpc_only();

create trigger calendar_event_links_rpc_only
  before insert or update or delete on public.calendar_event_links
  for each row execute function public.enforce_calendar_rpc_only();

create trigger calendar_ics_import_uids_rpc_only
  before insert or update or delete on public.calendar_ics_import_uids
  for each row execute function public.enforce_calendar_rpc_only();

-- ---------------------------------------------------------------------------
-- Attachments bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'calendar-attachments',
  'calendar-attachments',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
)
on conflict (id) do nothing;

-- Ensure future households get a default household calendar
create or replace function public._ensure_household_calendars()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('householdos.calendar_mutation', 'rpc', true);
  if not exists (
    select 1 from public.household_calendars c
    where c.household_id = new.id and c.calendar_type = 'household' and c.is_archived = false
  ) then
    insert into public.household_calendars (household_id, name, calendar_type, visibility_default)
    values (new.id, 'Household', 'household', 'household');
  end if;
  return new;
end;
$$;

drop trigger if exists households_ensure_calendars on public.households;
create trigger households_ensure_calendars
  after insert on public.households
  for each row execute function public._ensure_household_calendars();

create or replace function public._ensure_personal_calendar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cal uuid;
  v_name text;
begin
  if new.status is distinct from 'active' then
    return new;
  end if;
  perform set_config('householdos.calendar_mutation', 'rpc', true);
  select coalesce(nullif(trim(p.display_name), ''), 'Personal') || ' calendar'
  into v_name
  from public.profiles p where p.id = new.user_id;

  select id into v_cal from public.household_calendars
  where household_id = new.household_id
    and calendar_type = 'personal'
    and owner_membership_id = new.id
    and is_archived = false
  limit 1;

  if v_cal is null then
    insert into public.household_calendars (
      household_id, name, calendar_type, visibility_default, owner_membership_id
    ) values (
      new.household_id, coalesce(v_name, 'Personal calendar'), 'personal', 'private_busy', new.id
    )
    returning id into v_cal;
  end if;

  insert into public.household_calendar_memberships (
    calendar_id, household_id, membership_id, access_role
  ) values (v_cal, new.household_id, new.id, 'owner')
  on conflict (calendar_id, membership_id) do nothing;

  insert into public.household_calendar_memberships (calendar_id, household_id, membership_id, access_role)
  select c.id, new.household_id, new.id, 'viewer'
  from public.household_calendars c
  where c.household_id = new.household_id
    and c.calendar_type = 'household'
    and c.is_archived = false
  on conflict (calendar_id, membership_id) do nothing;

  return new;
end;
$$;

drop trigger if exists memberships_ensure_personal_calendar on public.household_memberships;
create trigger memberships_ensure_personal_calendar
  after insert or update of status on public.household_memberships
  for each row execute function public._ensure_personal_calendar();

