-- Phase 4: shared household calendar schema
-- Tables: events, attendees, reminders, exceptions, occurrences, feed tokens

-- ---------------------------------------------------------------------------
-- calendar_events (recurrence master / one-time event)
-- ---------------------------------------------------------------------------
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete restrict,
  organizer_membership_id uuid not null references public.household_memberships (id) on delete restrict,
  title text not null check (char_length(trim(title)) >= 1 and char_length(title) <= 200),
  description text check (description is null or char_length(description) <= 4000),
  location text check (location is null or char_length(location) <= 500),
  category text not null default 'other' check (category in (
    'household_meeting',
    'social',
    'shared_meal',
    'guest_visit',
    'maintenance',
    'cleaning',
    'grocery_trip',
    'bill_deadline',
    'move_in_out',
    'personal',
    'other'
  )),
  visibility text not null default 'household' check (visibility in (
    'household',
    'participants',
    'private_busy'
  )),
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  all_day boolean not null default false,
  -- Timed fields
  starts_at timestamptz,
  ends_at timestamptz,
  -- All-day fields (end_date_exclusive is exclusive)
  start_date date,
  end_date_exclusive date,
  time_zone text not null default 'America/Chicago',
  rrule text check (rrule is null or char_length(rrule) <= 1000),
  recurrence_until date,
  recurrence_count integer check (recurrence_count is null or (recurrence_count >= 1 and recurrence_count <= 520)),
  series_id uuid not null default gen_random_uuid(),
  calendar_uid text not null,
  sequence integer not null default 0 check (sequence >= 0),
  event_guest_count integer not null default 0 check (event_guest_count >= 0 and event_guest_count <= 20),
  guest_label text check (guest_label is null or char_length(guest_label) <= 120),
  source_type text check (source_type is null or char_length(source_type) <= 64),
  source_id uuid,
  client_idempotency_key text not null,
  cancelled_at timestamptz,
  cancelled_by_membership_id uuid references public.household_memberships (id) on delete restrict,
  cancellation_reason text check (
    cancellation_reason is null or char_length(trim(cancellation_reason)) >= 1
  ),
  materialized_through timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, organizer_membership_id, client_idempotency_key),
  unique (calendar_uid),
  check (
    (
      all_day = false
      and starts_at is not null
      and ends_at is not null
      and ends_at > starts_at
      and start_date is null
      and end_date_exclusive is null
    )
    or (
      all_day = true
      and starts_at is null
      and ends_at is null
      and start_date is not null
      and end_date_exclusive is not null
      and end_date_exclusive > start_date
    )
  ),
  check (
    (status = 'scheduled' and cancelled_at is null)
    or (
      status = 'cancelled'
      and cancelled_at is not null
      and cancelled_by_membership_id is not null
    )
  ),
  unique (id, household_id)
);

create index calendar_events_household_status_idx
  on public.calendar_events (household_id, status, starts_at);
create index calendar_events_household_dates_idx
  on public.calendar_events (household_id, start_date, end_date_exclusive)
  where all_day = true;
create index calendar_events_organizer_idx
  on public.calendar_events (organizer_membership_id);
create index calendar_events_series_idx
  on public.calendar_events (series_id);
create index calendar_events_materialize_idx
  on public.calendar_events (status, materialized_through)
  where rrule is not null and status = 'scheduled';

create trigger calendar_events_set_updated_at
  before update on public.calendar_events
  for each row execute function public.set_updated_at();

comment on table public.calendar_events is
  'Household calendar masters (one-time or recurring). Organizer is derived from auth membership in RPCs.';

-- ---------------------------------------------------------------------------
-- calendar_event_attendees
-- ---------------------------------------------------------------------------
create table public.calendar_event_attendees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.calendar_events (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete restrict,
  membership_id uuid not null references public.household_memberships (id) on delete restrict,
  participation_role text not null default 'invitee' check (participation_role in (
    'organizer',
    'invitee',
    'optional'
  )),
  rsvp_status text not null default 'needs_action' check (rsvp_status in (
    'needs_action',
    'going',
    'maybe',
    'not_going'
  )),
  guest_count integer not null default 0 check (guest_count >= 0 and guest_count <= 20),
  guest_note text check (guest_note is null or char_length(guest_note) <= 240),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, membership_id),
  foreign key (event_id, household_id)
    references public.calendar_events (id, household_id) on delete cascade
);

create index calendar_event_attendees_membership_idx
  on public.calendar_event_attendees (membership_id, rsvp_status);
create index calendar_event_attendees_household_idx
  on public.calendar_event_attendees (household_id, event_id);

create trigger calendar_event_attendees_set_updated_at
  before update on public.calendar_event_attendees
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- calendar_event_reminders (templates on master; fire per occurrence)
-- ---------------------------------------------------------------------------
create table public.calendar_event_reminders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.calendar_events (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete restrict,
  offset_minutes integer not null check (
    offset_minutes >= 0 and offset_minutes <= 10080
  ),
  recipient_groups text[] not null default array['organizer', 'going']::text[],
  created_at timestamptz not null default now(),
  unique (event_id, offset_minutes),
  foreign key (event_id, household_id)
    references public.calendar_events (id, household_id) on delete cascade,
  check (cardinality(recipient_groups) >= 1 and cardinality(recipient_groups) <= 4)
);

create index calendar_event_reminders_event_idx
  on public.calendar_event_reminders (event_id);

-- ---------------------------------------------------------------------------
-- calendar_event_exceptions (cancelled / override for one original instance)
-- ---------------------------------------------------------------------------
create table public.calendar_event_exceptions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.calendar_events (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete restrict,
  original_starts_at timestamptz not null,
  kind text not null check (kind in ('cancelled', 'override')),
  all_day boolean,
  starts_at timestamptz,
  ends_at timestamptz,
  start_date date,
  end_date_exclusive date,
  title text check (title is null or (char_length(trim(title)) >= 1 and char_length(title) <= 200)),
  description text check (description is null or char_length(description) <= 4000),
  location text check (location is null or char_length(location) <= 500),
  event_guest_count integer check (event_guest_count is null or (event_guest_count >= 0 and event_guest_count <= 20)),
  guest_label text check (guest_label is null or char_length(guest_label) <= 120),
  created_by_membership_id uuid not null references public.household_memberships (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, original_starts_at),
  foreign key (event_id, household_id)
    references public.calendar_events (id, household_id) on delete cascade,
  check (
    (kind = 'cancelled')
    or (
      kind = 'override'
      and (
        (all_day = false and starts_at is not null and ends_at is not null and ends_at > starts_at)
        or (all_day = true and start_date is not null and end_date_exclusive is not null
            and end_date_exclusive > start_date)
        or title is not null
        or description is not null
        or location is not null
      )
    )
  )
);

create trigger calendar_event_exceptions_set_updated_at
  before update on public.calendar_event_exceptions
  for each row execute function public.set_updated_at();

create index calendar_event_exceptions_event_idx
  on public.calendar_event_exceptions (event_id, original_starts_at);

-- ---------------------------------------------------------------------------
-- calendar_event_occurrences (bounded materialization)
-- ---------------------------------------------------------------------------
create table public.calendar_event_occurrences (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.calendar_events (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete restrict,
  original_starts_at timestamptz not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  start_date date,
  end_date_exclusive date,
  is_cancelled boolean not null default false,
  exception_id uuid references public.calendar_event_exceptions (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, original_starts_at),
  foreign key (event_id, household_id)
    references public.calendar_events (id, household_id) on delete cascade,
  check (ends_at > starts_at)
);

create index calendar_event_occurrences_range_idx
  on public.calendar_event_occurrences (household_id, starts_at, ends_at)
  where is_cancelled = false;
create index calendar_event_occurrences_event_idx
  on public.calendar_event_occurrences (event_id, starts_at);

create trigger calendar_event_occurrences_set_updated_at
  before update on public.calendar_event_occurrences
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- calendar_feed_tokens (store hash only; raw token is a secret)
-- ---------------------------------------------------------------------------
create table public.calendar_feed_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  token_hash text not null,
  label text not null default 'Personal calendar feed'
    check (char_length(trim(label)) >= 1 and char_length(label) <= 120),
  scope text not null default 'visible_to_me' check (scope in (
    'visible_to_me',
    'household_public_only'
  )),
  created_at timestamptz not null default now(),
  last_accessed_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz,
  created_by_user_id uuid not null references auth.users (id) on delete cascade,
  unique (token_hash)
);

create index calendar_feed_tokens_user_household_idx
  on public.calendar_feed_tokens (user_id, household_id)
  where revoked_at is null;
create index calendar_feed_tokens_hash_idx
  on public.calendar_feed_tokens (token_hash)
  where revoked_at is null;

comment on table public.calendar_feed_tokens is
  'Revocable personal iCalendar feed tokens. Only the cryptographic hash is stored.';

-- ---------------------------------------------------------------------------
-- RPC-only mutation guards
-- ---------------------------------------------------------------------------
create or replace function public.enforce_calendar_rpc_only()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  if current_setting('householdos.calendar_mutation', true) is distinct from 'rpc'
     and current_setting('householdos.privileged_mutation', true) is distinct from 'on' then
    raise exception 'Calendar records may only be written by secure functions';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger calendar_events_rpc_only
  before insert or update or delete on public.calendar_events
  for each row execute function public.enforce_calendar_rpc_only();

create trigger calendar_event_attendees_rpc_only
  before insert or update or delete on public.calendar_event_attendees
  for each row execute function public.enforce_calendar_rpc_only();

create trigger calendar_event_reminders_rpc_only
  before insert or update or delete on public.calendar_event_reminders
  for each row execute function public.enforce_calendar_rpc_only();

create trigger calendar_event_exceptions_rpc_only
  before insert or update or delete on public.calendar_event_exceptions
  for each row execute function public.enforce_calendar_rpc_only();

create trigger calendar_event_occurrences_rpc_only
  before insert or update or delete on public.calendar_event_occurrences
  for each row execute function public.enforce_calendar_rpc_only();

create trigger calendar_feed_tokens_rpc_only
  before insert or update or delete on public.calendar_feed_tokens
  for each row execute function public.enforce_calendar_rpc_only();

-- Block silent status restore / direct cancel bypass on calendar_events
create or replace function public.enforce_calendar_event_status()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and old.status = 'cancelled'
     and new.status is distinct from 'cancelled' then
    raise exception 'Cancelled calendar events cannot be restored by direct update';
  end if;
  if tg_op = 'UPDATE'
     and old.status = 'scheduled'
     and new.status = 'cancelled'
     and current_setting('householdos.calendar_mutation', true) is distinct from 'rpc'
     and auth.uid() is not null then
    raise exception 'Use cancel_calendar_event to cancel events';
  end if;
  return new;
end;
$$;

create trigger calendar_events_status_guard
  before update on public.calendar_events
  for each row execute function public.enforce_calendar_event_status();
