-- Meeting-Money-B: Monthly Household Review lifecycle and locked packets

create table public.household_meetings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete restrict,
  status text not null default 'draft' check (status in (
    'draft',
    'preparing',
    'ready_for_review',
    'locked',
    'in_progress',
    'completed',
    'published',
    'archived',
    'cancelled'
  )),
  title text not null default 'Monthly household review'
    check (char_length(trim(title)) between 1 and 200),
  meeting_at timestamptz,
  period_start date not null,
  period_end date not null,
  comparison_period_start date,
  comparison_period_end date,
  timezone text not null default 'America/Chicago',
  organizer_membership_id uuid not null references public.household_memberships (id) on delete restrict,
  packet_version integer not null default 1 check (packet_version >= 1),
  source_version text not null default '1',
  data_snapshot_at timestamptz,
  locked_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  published_at timestamptz,
  archived_at timestamptz,
  cancelled_at timestamptz,
  calendar_event_id uuid,
  client_idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique (id, household_id),
  unique (client_idempotency_key)
);

create index household_meetings_household_status_idx
  on public.household_meetings (household_id, status, meeting_at desc nulls last);

create table public.household_meeting_participants (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null,
  household_id uuid not null,
  membership_id uuid not null references public.household_memberships (id) on delete restrict,
  role text not null default 'participant'
    check (role in ('organizer', 'participant', 'optional')),
  acknowledged_packet_at timestamptz,
  attended boolean,
  created_at timestamptz not null default now(),
  unique (meeting_id, membership_id),
  foreign key (meeting_id, household_id)
    references public.household_meetings (id, household_id) on delete cascade
);

create table public.household_meeting_sections (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null,
  household_id uuid not null,
  section_key text not null check (char_length(trim(section_key)) between 1 and 80),
  title text not null check (char_length(trim(title)) between 1 and 200),
  sort_order integer not null default 0,
  included boolean not null default true,
  informational_only boolean not null default false,
  organizer_note text check (organizer_note is null or char_length(organizer_note) <= 4000),
  discussed_at timestamptz,
  skipped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meeting_id, section_key),
  foreign key (meeting_id, household_id)
    references public.household_meetings (id, household_id) on delete cascade
);

create table public.household_meeting_agenda_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null,
  household_id uuid not null,
  section_key text not null,
  source text not null default 'custom'
    check (source in ('suggested', 'custom', 'carryover')),
  title text not null check (char_length(trim(title)) between 1 and 300),
  why_included text check (why_included is null or char_length(why_included) <= 2000),
  deadline date,
  required_participants jsonb not null default '[]'::jsonb,
  source_entity_type text,
  source_entity_id uuid,
  status text not null default 'proposed'
    check (status in ('proposed', 'accepted', 'dismissed', 'discussed', 'deferred')),
  sort_order integer not null default 0,
  may_decide_in_meeting boolean not null default true,
  created_by_membership_id uuid references public.household_memberships (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (meeting_id, household_id)
    references public.household_meetings (id, household_id) on delete cascade
);

create index household_meeting_agenda_items_meeting_idx
  on public.household_meeting_agenda_items (meeting_id, sort_order);

create table public.household_meeting_packet_versions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null,
  household_id uuid not null,
  version integer not null check (version >= 1),
  kind text not null check (kind in ('preview', 'locked', 'recap')),
  created_by_membership_id uuid references public.household_memberships (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (meeting_id, version, kind),
  foreign key (meeting_id, household_id)
    references public.household_meetings (id, household_id) on delete cascade
);

create table public.household_meeting_snapshots (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null,
  household_id uuid not null,
  packet_version_id uuid not null references public.household_meeting_packet_versions (id) on delete cascade,
  projection text not null check (projection in ('shared', 'personal')),
  membership_id uuid references public.household_memberships (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  source_freshness jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (
    (projection = 'shared' and membership_id is null)
    or (projection = 'personal' and membership_id is not null)
  ),
  foreign key (meeting_id, household_id)
    references public.household_meetings (id, household_id) on delete cascade
);

create unique index household_meeting_snapshots_shared_uidx
  on public.household_meeting_snapshots (packet_version_id)
  where projection = 'shared';

create unique index household_meeting_snapshots_personal_uidx
  on public.household_meeting_snapshots (packet_version_id, membership_id)
  where projection = 'personal';

create table public.household_meeting_snapshot_values (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.household_meeting_snapshots (id) on delete cascade,
  household_id uuid not null,
  value_key text not null check (char_length(trim(value_key)) between 1 and 120),
  value_json jsonb not null,
  source_entity_type text,
  source_entity_id uuid,
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (snapshot_id, value_key)
);

create table public.household_meeting_session_notes (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null,
  household_id uuid not null,
  section_key text,
  agenda_item_id uuid references public.household_meeting_agenda_items (id) on delete set null,
  body text not null check (char_length(trim(body)) between 1 and 8000),
  parking_lot boolean not null default false,
  created_by_membership_id uuid not null references public.household_memberships (id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (meeting_id, household_id)
    references public.household_meetings (id, household_id) on delete cascade
);

create table public.household_meeting_decisions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null,
  household_id uuid not null,
  agenda_item_id uuid references public.household_meeting_agenda_items (id) on delete set null,
  decision_text text not null check (char_length(trim(decision_text)) between 1 and 4000),
  owner_membership_id uuid references public.household_memberships (id) on delete set null,
  created_by_membership_id uuid not null references public.household_memberships (id) on delete restrict,
  client_idempotency_key text,
  created_at timestamptz not null default now(),
  unique (client_idempotency_key),
  foreign key (meeting_id, household_id)
    references public.household_meetings (id, household_id) on delete cascade
);

create table public.household_meeting_action_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null,
  household_id uuid not null,
  decision_id uuid references public.household_meeting_decisions (id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 300),
  owner_membership_id uuid references public.household_memberships (id) on delete set null,
  due_date date,
  status text not null default 'open'
    check (status in ('open', 'completed', 'overdue', 'cancelled', 'needs_reassignment', 'blocked')),
  blocking_note text check (blocking_note is null or char_length(blocking_note) <= 2000),
  completed_at timestamptz,
  created_by_membership_id uuid not null references public.household_memberships (id) on delete restrict,
  client_idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_idempotency_key),
  foreign key (meeting_id, household_id)
    references public.household_meetings (id, household_id) on delete cascade
);

create table public.household_meeting_record_links (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null,
  household_id uuid not null,
  decision_id uuid references public.household_meeting_decisions (id) on delete cascade,
  action_item_id uuid references public.household_meeting_action_items (id) on delete cascade,
  entity_type text not null check (char_length(trim(entity_type)) between 1 and 80),
  entity_id uuid not null,
  created_by_membership_id uuid not null references public.household_memberships (id) on delete restrict,
  client_idempotency_key text,
  created_at timestamptz not null default now(),
  unique (client_idempotency_key),
  check (decision_id is not null or action_item_id is not null),
  foreign key (meeting_id, household_id)
    references public.household_meetings (id, household_id) on delete cascade
);

create table public.household_meeting_preferences (
  household_id uuid primary key references public.households (id) on delete cascade,
  recurrence_rule text check (recurrence_rule is null or char_length(recurrence_rule) <= 200),
  preferred_time_local time,
  timezone text not null default 'America/Chicago',
  auto_create_calendar boolean not null default false,
  reminder_prep_hours integer not null default 72 check (reminder_prep_hours >= 0),
  reminder_packet_hours integer not null default 24 check (reminder_packet_hours >= 0),
  utility_variance_pct integer not null default 15 check (utility_variance_pct >= 0),
  maintenance_wait_days integer not null default 14 check (maintenance_wait_days >= 0),
  purchase_deadline_days integer not null default 14 check (purchase_deadline_days >= 0),
  share_pairwise_balances boolean not null default false,
  agenda_rules_version text not null default '1',
  updated_by_membership_id uuid references public.household_memberships (id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create trigger household_meetings_set_updated_at
  before update on public.household_meetings
  for each row execute function public.set_updated_at();

create trigger household_meeting_sections_set_updated_at
  before update on public.household_meeting_sections
  for each row execute function public.set_updated_at();

create trigger household_meeting_agenda_items_set_updated_at
  before update on public.household_meeting_agenda_items
  for each row execute function public.set_updated_at();

create trigger household_meeting_action_items_set_updated_at
  before update on public.household_meeting_action_items
  for each row execute function public.set_updated_at();
