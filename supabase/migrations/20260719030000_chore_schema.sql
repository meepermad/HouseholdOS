-- Phase 5: chores, rotations, assignments, completion, and responsibility areas

create or replace function public._valid_chore_reminder_offsets(p_offsets int[])
returns boolean language sql immutable set search_path=public as $$
  select p_offsets is not null
    and cardinality(p_offsets) <= 5
    and not exists (select 1 from unnest(p_offsets) v where v is null or v < 0 or v > 10080)
$$;
revoke all on function public._valid_chore_reminder_offsets(int[]) from public, anon;

create table public.responsibility_areas (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 200),
  description text check (description is null or char_length(description) <= 4000),
  category text not null check (category in ('kitchen','bathroom','trash_recycling','floors','shared_spaces','laundry','supplies','outdoor','administrative','other')),
  status text not null default 'active' check (status in ('active','handoff_pending','paused','ended')),
  start_date date not null,
  end_date date,
  handoff_expectations text check (handoff_expectations is null or char_length(handoff_expectations) <= 4000),
  created_by_membership_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  foreign key (created_by_membership_id) references public.household_memberships(id) on delete restrict,
  check (end_date is null or end_date >= start_date)
);

create table public.chore_rotations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 200),
  strategy text not null check (strategy in ('fixed','round_robin','balanced','manual_sequence')),
  start_membership_id uuid,
  paused_at timestamptz,
  ended_at timestamptz,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  foreign key (start_membership_id) references public.household_memberships(id) on delete restrict,
  foreign key (created_by_membership_id) references public.household_memberships(id) on delete restrict,
  check (ended_at is null or paused_at is null)
);

create table public.chore_rotation_members (
  id uuid primary key default gen_random_uuid(),
  rotation_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  membership_id uuid not null,
  sort_order int not null check (sort_order >= 0),
  excluded_until timestamptz,
  created_at timestamptz not null default now(),
  unique (rotation_id, membership_id),
  unique (rotation_id, sort_order),
  foreign key (rotation_id, household_id) references public.chore_rotations(id, household_id) on delete cascade,
  foreign key (membership_id) references public.household_memberships(id) on delete restrict
);

create table public.chore_definitions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  created_by_membership_id uuid not null,
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text check (description is null or char_length(description) <= 4000),
  category text not null check (category in ('kitchen','bathroom','trash_recycling','floors','shared_spaces','laundry','supplies','outdoor','administrative','other')),
  visibility text not null default 'household' check (visibility in ('household','assignees')),
  status text not null default 'active' check (status in ('active','paused','ended')),
  rrule text check (rrule is null or char_length(rrule) <= 1000),
  time_zone text not null default 'America/Chicago' check (char_length(trim(time_zone)) > 0),
  all_day boolean not null default false,
  due_time_minutes int check (due_time_minutes is null or due_time_minutes between 0 and 1439),
  start_date date not null,
  end_date date,
  recurrence_count int check (recurrence_count is null or recurrence_count between 1 and 520),
  grace_period_minutes int not null default 120 check (grace_period_minutes between 0 and 10080),
  requires_verification boolean not null default false,
  verifier_membership_id uuid,
  show_on_calendar boolean not null default true,
  calendar_category text not null default 'chores' check (calendar_category in ('chores','household')),
  rotation_id uuid,
  responsibility_area_id uuid,
  reminder_offsets int[] not null default '{1440,120}'::int[],
  escalation_coordinator boolean not null default false,
  paused_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  materialized_through timestamptz,
  unique (id, household_id),
  foreign key (created_by_membership_id) references public.household_memberships(id) on delete restrict,
  foreign key (verifier_membership_id) references public.household_memberships(id) on delete restrict,
  foreign key (rotation_id, household_id) references public.chore_rotations(id, household_id) on delete set null (rotation_id),
  foreign key (responsibility_area_id, household_id) references public.responsibility_areas(id, household_id) on delete set null (responsibility_area_id),
  check ((all_day and due_time_minutes is null) or (not all_day and due_time_minutes is not null)),
  check (end_date is null or end_date >= start_date),
  check (public._valid_chore_reminder_offsets(reminder_offsets)),
  check ((status = 'active' and paused_at is null and ended_at is null)
      or (status = 'paused' and paused_at is not null and ended_at is null)
      or (status = 'ended' and ended_at is not null))
);

create table public.chore_occurrences (
  id uuid primary key default gen_random_uuid(),
  definition_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  occurrence_index int not null check (occurrence_index >= 0),
  original_due_at timestamptz not null,
  due_at timestamptz not null,
  all_day boolean not null default false,
  due_date date,
  status text not null default 'scheduled' check (status in ('scheduled','in_progress','completed','blocked','skipped','cancelled','awaiting_verification','verified','reopened')),
  assignment_version int not null default 1 check (assignment_version >= 1),
  calendar_event_id uuid references public.calendar_events(id) on delete set null,
  grace_ends_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  started_at timestamptz,
  skip_reason text,
  blocked_reason text,
  blocked_note text check (blocked_note is null or char_length(blocked_note) <= 2000),
  reopen_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  unique (definition_id, original_due_at),
  unique (definition_id, occurrence_index),
  foreign key (definition_id, household_id) references public.chore_definitions(id, household_id) on delete cascade,
  check ((all_day and due_date is not null) or (not all_day and due_date is null))
);

create table public.chore_assignments (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  membership_id uuid not null,
  role text not null default 'primary' check (role in ('primary','collaborator','verifier')),
  status text not null default 'assigned' check (status in ('assigned','accepted','claimed','declined','released')),
  assigned_at timestamptz not null default now(),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (occurrence_id, membership_id),
  foreign key (occurrence_id, household_id) references public.chore_occurrences(id, household_id) on delete cascade,
  foreign key (membership_id) references public.household_memberships(id) on delete restrict
);

create table public.chore_completion_records (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  completed_by_membership_id uuid not null,
  completion_note text check (completion_note is null or char_length(completion_note) <= 2000),
  status text not null default 'submitted' check (status in ('submitted','verified','reopened')),
  submitted_at timestamptz not null default now(),
  verified_at timestamptz,
  verified_by_membership_id uuid,
  reopen_reason text,
  version int not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  unique (occurrence_id, version),
  foreign key (occurrence_id, household_id) references public.chore_occurrences(id, household_id) on delete cascade,
  foreign key (completed_by_membership_id) references public.household_memberships(id) on delete restrict,
  foreign key (verified_by_membership_id) references public.household_memberships(id) on delete restrict
);

create table public.chore_reassignment_requests (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  requested_by_membership_id uuid not null,
  suggested_membership_id uuid,
  reason text not null check (char_length(trim(reason)) between 1 and 2000),
  requested_effective_at timestamptz,
  status text not null default 'pending' check (status in ('pending','approved','declined','withdrawn')),
  resolved_by_membership_id uuid,
  resolved_at timestamptz,
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  foreign key (occurrence_id, household_id) references public.chore_occurrences(id, household_id) on delete cascade,
  foreign key (requested_by_membership_id) references public.household_memberships(id) on delete restrict,
  foreign key (suggested_membership_id) references public.household_memberships(id) on delete restrict,
  foreign key (resolved_by_membership_id) references public.household_memberships(id) on delete restrict,
  check ((status = 'pending' and resolved_at is null and resolved_by_membership_id is null)
      or (status <> 'pending' and resolved_at is not null and resolved_by_membership_id is not null))
);

create table public.responsibility_assignments (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  membership_id uuid not null,
  role text not null check (role in ('owner','co_owner')),
  status text not null default 'active' check (status in ('active','ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (area_id, household_id) references public.responsibility_areas(id, household_id) on delete cascade,
  foreign key (membership_id) references public.household_memberships(id) on delete restrict,
  check ((status = 'active' and ended_at is null) or (status = 'ended' and ended_at is not null))
);

create unique index responsibility_assignments_active_member_uidx on public.responsibility_assignments(area_id, membership_id) where status = 'active';
create unique index responsibility_assignments_single_owner_uidx on public.responsibility_assignments(area_id) where status = 'active' and role = 'owner';

create table public.responsibility_transfers (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  from_membership_id uuid not null,
  to_membership_id uuid not null,
  status text not null default 'pending' check (status in ('pending','accepted','declined','withdrawn')),
  note text check (note is null or char_length(note) <= 2000),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  foreign key (area_id, household_id) references public.responsibility_areas(id, household_id) on delete cascade,
  foreign key (from_membership_id) references public.household_memberships(id) on delete restrict,
  foreign key (to_membership_id) references public.household_memberships(id) on delete restrict,
  check (from_membership_id <> to_membership_id),
  check ((status = 'pending' and resolved_at is null) or (status <> 'pending' and resolved_at is not null))
);

create unique index chore_reassignment_pending_uidx on public.chore_reassignment_requests(occurrence_id, requested_by_membership_id) where status = 'pending';
create unique index responsibility_transfers_pending_uidx on public.responsibility_transfers(area_id) where status = 'pending';
create index chore_rotations_household_idx on public.chore_rotations(household_id);
create index chore_rotation_members_membership_idx on public.chore_rotation_members(membership_id);
create index chore_definitions_household_status_idx on public.chore_definitions(household_id,status);
create index chore_definitions_rotation_idx on public.chore_definitions(rotation_id);
create index chore_occurrences_household_due_idx on public.chore_occurrences(household_id,due_at);
create index chore_occurrences_status_due_idx on public.chore_occurrences(status,due_at);
create index chore_occurrences_definition_idx on public.chore_occurrences(definition_id,due_at);
create index chore_assignments_membership_idx on public.chore_assignments(membership_id,status);
create index chore_assignments_occurrence_idx on public.chore_assignments(occurrence_id);
create index chore_completion_occurrence_idx on public.chore_completion_records(occurrence_id);
create index chore_reassignment_household_status_idx on public.chore_reassignment_requests(household_id,status);
create index responsibility_areas_household_status_idx on public.responsibility_areas(household_id,status);
create index responsibility_assignments_membership_idx on public.responsibility_assignments(membership_id,status);
create index responsibility_transfers_household_status_idx on public.responsibility_transfers(household_id,status);

create trigger responsibility_areas_set_updated_at before update on public.responsibility_areas for each row execute function public.set_updated_at();
create trigger chore_rotations_set_updated_at before update on public.chore_rotations for each row execute function public.set_updated_at();
create trigger chore_definitions_set_updated_at before update on public.chore_definitions for each row execute function public.set_updated_at();
create trigger chore_occurrences_set_updated_at before update on public.chore_occurrences for each row execute function public.set_updated_at();
create trigger chore_assignments_set_updated_at before update on public.chore_assignments for each row execute function public.set_updated_at();
create trigger chore_reassignment_requests_set_updated_at before update on public.chore_reassignment_requests for each row execute function public.set_updated_at();
create trigger responsibility_transfers_set_updated_at before update on public.responsibility_transfers for each row execute function public.set_updated_at();

create or replace function public.enforce_chore_rpc_only() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null
     and current_setting('householdos.chore_mutation', true) is distinct from 'rpc'
     and current_setting('householdos.privileged_mutation', true) is distinct from 'on' then
    raise exception 'Chore and responsibility records may only be written by secure functions';
  end if;
  return coalesce(new,old);
end $$;

create or replace function public.enforce_chore_occurrence_status() returns trigger language plpgsql as $$
begin
  if old.status is distinct from new.status
     and auth.uid() is not null
     and current_setting('householdos.chore_mutation', true) is distinct from 'rpc'
     and current_setting('householdos.privileged_mutation', true) is distinct from 'on' then
    raise exception 'Use a chore lifecycle RPC to change occurrence status';
  end if;
  return new;
end $$;

create trigger chore_occurrences_status_guard before update on public.chore_occurrences for each row execute function public.enforce_chore_occurrence_status();
create trigger responsibility_areas_rpc_only before insert or update or delete on public.responsibility_areas for each row execute function public.enforce_chore_rpc_only();
create trigger chore_rotations_rpc_only before insert or update or delete on public.chore_rotations for each row execute function public.enforce_chore_rpc_only();
create trigger chore_rotation_members_rpc_only before insert or update or delete on public.chore_rotation_members for each row execute function public.enforce_chore_rpc_only();
create trigger chore_definitions_rpc_only before insert or update or delete on public.chore_definitions for each row execute function public.enforce_chore_rpc_only();
create trigger chore_occurrences_rpc_only before insert or update or delete on public.chore_occurrences for each row execute function public.enforce_chore_rpc_only();
create trigger chore_assignments_rpc_only before insert or update or delete on public.chore_assignments for each row execute function public.enforce_chore_rpc_only();
create trigger chore_completion_records_rpc_only before insert or update or delete on public.chore_completion_records for each row execute function public.enforce_chore_rpc_only();
create trigger chore_reassignment_requests_rpc_only before insert or update or delete on public.chore_reassignment_requests for each row execute function public.enforce_chore_rpc_only();
create trigger responsibility_assignments_rpc_only before insert or update or delete on public.responsibility_assignments for each row execute function public.enforce_chore_rpc_only();
create trigger responsibility_transfers_rpc_only before insert or update or delete on public.responsibility_transfers for each row execute function public.enforce_chore_rpc_only();
