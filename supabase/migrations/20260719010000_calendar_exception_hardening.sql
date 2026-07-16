-- Phase 5 / Phase 4 hardening: metadata-only occurrence overrides
-- Corrective migration — does not rewrite applied calendar migrations.

-- ---------------------------------------------------------------------------
-- 1. Widen override CHECK: guest/metadata-only overrides are valid
-- ---------------------------------------------------------------------------
alter table public.calendar_event_exceptions
  drop constraint if exists calendar_event_exceptions_check;

alter table public.calendar_event_exceptions
  add column if not exists overrides_attendees boolean not null default false;

alter table public.calendar_event_exceptions
  add column if not exists overrides_reminders boolean not null default false;

-- True when timed bounds are fully specified on the exception
create or replace function public._calendar_exception_has_time_override(
  p_kind text,
  p_all_day boolean,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_start_date date,
  p_end_date_exclusive date
)
returns boolean
language sql
immutable
as $$
  select
    p_kind = 'override'
    and (
      (p_all_day = false and p_starts_at is not null and p_ends_at is not null and p_ends_at > p_starts_at)
      or (p_all_day = true and p_start_date is not null and p_end_date_exclusive is not null
          and p_end_date_exclusive > p_start_date)
    );
$$;

alter table public.calendar_event_exceptions
  add constraint calendar_event_exceptions_override_meaningful check (
    (kind = 'cancelled')
    or (
      kind = 'override'
      and (
        public._calendar_exception_has_time_override(
          kind, all_day, starts_at, ends_at, start_date, end_date_exclusive
        )
        or title is not null
        or description is not null
        or location is not null
        or event_guest_count is not null
        or guest_label is not null
        or overrides_attendees = true
        or overrides_reminders = true
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Per-occurrence attendee / reminder override tables
-- ---------------------------------------------------------------------------
create table if not exists public.calendar_event_exception_attendees (
  id uuid primary key default gen_random_uuid(),
  exception_id uuid not null references public.calendar_event_exceptions (id) on delete cascade,
  event_id uuid not null references public.calendar_events (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete restrict,
  membership_id uuid not null references public.household_memberships (id) on delete restrict,
  participation_role text not null default 'optional'
    check (participation_role in ('required', 'optional')),
  rsvp_status text not null default 'needs_action'
    check (rsvp_status in ('needs_action', 'going', 'maybe', 'not_going')),
  guest_count integer not null default 0 check (guest_count >= 0 and guest_count <= 20),
  guest_note text check (guest_note is null or char_length(guest_note) <= 240),
  created_at timestamptz not null default now(),
  unique (exception_id, membership_id),
  foreign key (event_id, household_id)
    references public.calendar_events (id, household_id) on delete cascade
);

create index if not exists calendar_event_exception_attendees_exception_idx
  on public.calendar_event_exception_attendees (exception_id);

create table if not exists public.calendar_event_exception_reminders (
  id uuid primary key default gen_random_uuid(),
  exception_id uuid not null references public.calendar_event_exceptions (id) on delete cascade,
  event_id uuid not null references public.calendar_events (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete restrict,
  offset_minutes integer not null check (
    offset_minutes >= 0 and offset_minutes <= 10080
  ),
  recipient_groups text[] not null default array['organizer', 'going']::text[],
  created_at timestamptz not null default now(),
  unique (exception_id, offset_minutes),
  foreign key (event_id, household_id)
    references public.calendar_events (id, household_id) on delete cascade,
  check (cardinality(recipient_groups) >= 1 and cardinality(recipient_groups) <= 4)
);

create index if not exists calendar_event_exception_reminders_exception_idx
  on public.calendar_event_exception_reminders (exception_id);

-- RPC-only writes
create trigger calendar_event_exception_attendees_rpc_only
  before insert or update or delete on public.calendar_event_exception_attendees
  for each row execute function public.enforce_calendar_rpc_only();

create trigger calendar_event_exception_reminders_rpc_only
  before insert or update or delete on public.calendar_event_exception_reminders
  for each row execute function public.enforce_calendar_rpc_only();

alter table public.calendar_event_exception_attendees enable row level security;
alter table public.calendar_event_exception_reminders enable row level security;

-- Same visibility as parent exception (household-visible or participant)
create policy calendar_event_exception_attendees_select
  on public.calendar_event_exception_attendees
  for select to authenticated
  using (
    public.is_active_member(household_id)
    and (
      exists (
        select 1 from public.calendar_events e
        where e.id = event_id and e.visibility = 'household'
      )
      or public.is_calendar_event_participant(event_id)
    )
  );

create policy calendar_event_exception_reminders_select
  on public.calendar_event_exception_reminders
  for select to authenticated
  using (
    public.is_active_member(household_id)
    and public.is_calendar_event_participant(event_id)
  );

revoke all on table public.calendar_event_exception_attendees from public, anon;
revoke all on table public.calendar_event_exception_reminders from public, anon;
grant select on table public.calendar_event_exception_attendees to authenticated;
grant select on table public.calendar_event_exception_reminders to authenticated;
grant all on table public.calendar_event_exception_attendees to service_role;
grant all on table public.calendar_event_exception_reminders to service_role;

-- ---------------------------------------------------------------------------
-- 3. Replace update_calendar_occurrence with coalesce + metadata/attendee/reminder support
-- ---------------------------------------------------------------------------
drop function if exists public.update_calendar_occurrence(
  uuid, timestamptz, boolean, timestamptz, timestamptz, date, date, text, text, text, int, text
);

create or replace function public.update_calendar_occurrence(
  p_event_id uuid,
  p_original_starts_at timestamptz,
  p_all_day boolean default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_start_date date default null,
  p_end_date_exclusive date default null,
  p_title text default null,
  p_description text default null,
  p_location text default null,
  p_event_guest_count int default null,
  p_guest_label text default null,
  p_clear_title boolean default false,
  p_clear_description boolean default false,
  p_clear_location boolean default false,
  p_clear_guest_label boolean default false,
  p_attendee_membership_ids uuid[] default null,
  p_reminder_offsets int[] default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.calendar_events%rowtype;
  v_actor uuid;
  v_exception_id uuid;
  v_existing public.calendar_event_exceptions%rowtype;
  v_title text;
  v_description text;
  v_location text;
  v_guest_count int;
  v_guest_label text;
  v_all_day boolean;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_start_date date;
  v_end_date_exclusive date;
  v_overrides_attendees boolean;
  v_overrides_reminders boolean;
  v_mid uuid;
  v_offset int;
  v_has_meaningful boolean;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_original_starts_at is null then
    raise exception 'original_starts_at is required';
  end if;

  perform set_config('householdos.calendar_mutation', 'rpc', true);

  select * into v_event from public.calendar_events where id = p_event_id for update;
  if not found then
    raise exception 'Calendar event not found';
  end if;
  if v_event.status <> 'scheduled' then
    raise exception 'Only scheduled events can be modified';
  end if;

  v_actor := public._calendar_active_membership(v_event.household_id);
  if v_actor <> v_event.organizer_membership_id then
    raise exception 'Only the organizer may modify an occurrence';
  end if;

  select * into v_existing
  from public.calendar_event_exceptions
  where event_id = p_event_id
    and original_starts_at = p_original_starts_at;

  -- Merge: provided values win; clear flags null out; otherwise keep existing / leave null (inherit)
  if p_clear_title then
    v_title := null;
  elsif p_title is not null then
    v_title := nullif(trim(p_title), '');
  else
    v_title := v_existing.title;
  end if;

  if p_clear_description then
    v_description := null;
  elsif p_description is not null then
    v_description := nullif(trim(p_description), '');
  else
    v_description := v_existing.description;
  end if;

  if p_clear_location then
    v_location := null;
  elsif p_location is not null then
    v_location := nullif(trim(p_location), '');
  else
    v_location := v_existing.location;
  end if;

  if p_event_guest_count is not null then
    if p_event_guest_count < 0 or p_event_guest_count > 20 then
      raise exception 'Invalid guest count';
    end if;
    v_guest_count := p_event_guest_count;
  else
    v_guest_count := v_existing.event_guest_count;
  end if;

  if p_clear_guest_label then
    v_guest_label := null;
  elsif p_guest_label is not null then
    v_guest_label := nullif(trim(p_guest_label), '');
  else
    v_guest_label := v_existing.guest_label;
  end if;

  -- Time fields: only overwrite when caller supplies a time change
  if p_starts_at is not null or p_ends_at is not null or p_start_date is not null
     or p_end_date_exclusive is not null or p_all_day is not null then
    v_all_day := coalesce(p_all_day, v_existing.all_day, v_event.all_day);
    v_starts_at := coalesce(p_starts_at, v_existing.starts_at);
    v_ends_at := coalesce(p_ends_at, v_existing.ends_at);
    v_start_date := coalesce(p_start_date, v_existing.start_date);
    v_end_date_exclusive := coalesce(p_end_date_exclusive, v_existing.end_date_exclusive);
  else
    v_all_day := v_existing.all_day;
    v_starts_at := v_existing.starts_at;
    v_ends_at := v_existing.ends_at;
    v_start_date := v_existing.start_date;
    v_end_date_exclusive := v_existing.end_date_exclusive;
  end if;

  v_overrides_attendees := case
    when p_attendee_membership_ids is not null then true
    else coalesce(v_existing.overrides_attendees, false)
  end;
  v_overrides_reminders := case
    when p_reminder_offsets is not null then true
    else coalesce(v_existing.overrides_reminders, false)
  end;

  v_has_meaningful :=
    public._calendar_exception_has_time_override(
      'override', v_all_day, v_starts_at, v_ends_at, v_start_date, v_end_date_exclusive
    )
    or v_title is not null
    or v_description is not null
    or v_location is not null
    or v_guest_count is not null
    or v_guest_label is not null
    or v_overrides_attendees
    or v_overrides_reminders;

  if not v_has_meaningful then
    raise exception 'Occurrence override must change at least one field';
  end if;

  insert into public.calendar_event_exceptions (
    event_id, household_id, original_starts_at, kind, all_day,
    starts_at, ends_at, start_date, end_date_exclusive,
    title, description, location, event_guest_count, guest_label,
    overrides_attendees, overrides_reminders,
    created_by_membership_id
  ) values (
    p_event_id, v_event.household_id, p_original_starts_at, 'override',
    v_all_day, v_starts_at, v_ends_at, v_start_date, v_end_date_exclusive,
    v_title, v_description, v_location, v_guest_count, v_guest_label,
    v_overrides_attendees, v_overrides_reminders,
    v_actor
  )
  on conflict (event_id, original_starts_at) do update
    set kind = 'override',
        all_day = excluded.all_day,
        starts_at = excluded.starts_at,
        ends_at = excluded.ends_at,
        start_date = excluded.start_date,
        end_date_exclusive = excluded.end_date_exclusive,
        title = excluded.title,
        description = excluded.description,
        location = excluded.location,
        event_guest_count = excluded.event_guest_count,
        guest_label = excluded.guest_label,
        overrides_attendees = excluded.overrides_attendees,
        overrides_reminders = excluded.overrides_reminders,
        created_by_membership_id = excluded.created_by_membership_id,
        updated_at = now()
  returning id into v_exception_id;

  if p_attendee_membership_ids is not null then
    delete from public.calendar_event_exception_attendees
    where exception_id = v_exception_id;

    foreach v_mid in array p_attendee_membership_ids loop
      if not exists (
        select 1 from public.household_memberships m
        where m.id = v_mid
          and m.household_id = v_event.household_id
          and m.status = 'active'
      ) then
        raise exception 'Cross-household or inactive attendee rejected';
      end if;
      insert into public.calendar_event_exception_attendees (
        exception_id, event_id, household_id, membership_id
      ) values (
        v_exception_id, p_event_id, v_event.household_id, v_mid
      );
    end loop;
  end if;

  if p_reminder_offsets is not null then
    delete from public.calendar_event_exception_reminders
    where exception_id = v_exception_id;

    foreach v_offset in array p_reminder_offsets loop
      if v_offset < 0 or v_offset > 10080 then
        raise exception 'Invalid reminder offset';
      end if;
      insert into public.calendar_event_exception_reminders (
        exception_id, event_id, household_id, offset_minutes
      ) values (
        v_exception_id, p_event_id, v_event.household_id, v_offset
      )
      on conflict (exception_id, offset_minutes) do nothing;
    end loop;
  end if;

  update public.calendar_event_occurrences o
  set starts_at = coalesce(v_starts_at, o.starts_at),
      ends_at = coalesce(v_ends_at, o.ends_at),
      all_day = coalesce(v_all_day, o.all_day),
      start_date = case when v_start_date is not null then v_start_date else o.start_date end,
      end_date_exclusive = case when v_end_date_exclusive is not null
                                then v_end_date_exclusive else o.end_date_exclusive end,
      is_cancelled = false,
      exception_id = v_exception_id,
      updated_at = now()
  where o.event_id = p_event_id
    and o.original_starts_at = p_original_starts_at;

  -- Rematerialize reminder schedules for this event after override
  perform public._reconcile_calendar_reminders(p_event_id);

  perform public._calendar_audit(
    v_event.household_id, 'calendar_occurrence', p_event_id, 'calendar.occurrence_updated',
    null,
    jsonb_build_object(
      'original_starts_at', p_original_starts_at,
      'exception_id', v_exception_id,
      'overrides_attendees', v_overrides_attendees,
      'overrides_reminders', v_overrides_reminders
    ),
    null, null
  );

  return v_exception_id;
end;
$$;

revoke all on function public.update_calendar_occurrence(
  uuid, timestamptz, boolean, timestamptz, timestamptz, date, date,
  text, text, text, int, text, boolean, boolean, boolean, boolean, uuid[], int[]
) from public, anon;
grant execute on function public.update_calendar_occurrence(
  uuid, timestamptz, boolean, timestamptz, timestamptz, date, date,
  text, text, text, int, text, boolean, boolean, boolean, boolean, uuid[], int[]
) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Effective occurrence projection helper (deterministic merge)
-- ---------------------------------------------------------------------------
create or replace function public.effective_calendar_occurrence_fields(
  p_event_id uuid,
  p_original_starts_at timestamptz
)
returns table (
  title text,
  description text,
  location text,
  event_guest_count int,
  guest_label text,
  overrides_attendees boolean,
  overrides_reminders boolean,
  exception_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(x.title, e.title) as title,
    coalesce(x.description, e.description) as description,
    coalesce(x.location, e.location) as location,
    coalesce(x.event_guest_count, e.event_guest_count) as event_guest_count,
    coalesce(x.guest_label, e.guest_label) as guest_label,
    coalesce(x.overrides_attendees, false) as overrides_attendees,
    coalesce(x.overrides_reminders, false) as overrides_reminders,
    x.id as exception_id
  from public.calendar_events e
  left join public.calendar_event_exceptions x
    on x.event_id = e.id
   and x.original_starts_at = p_original_starts_at
   and x.kind = 'override'
  where e.id = p_event_id;
$$;

revoke all on function public.effective_calendar_occurrence_fields(uuid, timestamptz)
  from public, anon;
grant execute on function public.effective_calendar_occurrence_fields(uuid, timestamptz)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Reminder reconcile: honor per-occurrence reminder + attendee overrides
-- ---------------------------------------------------------------------------
create or replace function public._reconcile_calendar_reminders(p_event_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.calendar_events%rowtype;
  v_occ_ids uuid[];
  v_occ public.calendar_event_occurrences%rowtype;
  v_rem record;
  v_fire_at timestamptz;
  v_user_id uuid;
  v_recipients uuid[];
  v_organizer_user uuid;
  v_action_href text;
  v_idem text;
  v_count integer := 0;
  v_ex public.calendar_event_exceptions%rowtype;
begin
  select * into v_event from public.calendar_events where id = p_event_id;
  if not found then
    return 0;
  end if;

  perform set_config('householdos.calendar_mutation', 'rpc', true);

  select array_agg(o.id) into v_occ_ids
  from public.calendar_event_occurrences o
  where o.event_id = p_event_id;

  if v_occ_ids is not null then
    update public.scheduled_notification_requests
    set cancelled_at = now(), updated_at = now()
    where source_type = 'calendar_occurrence'
      and source_id = any (v_occ_ids)
      and processed_at is null
      and cancelled_at is null;
  end if;

  if v_event.status <> 'scheduled' then
    return 0;
  end if;

  v_organizer_user := public._calendar_user_id_for_membership(v_event.organizer_membership_id);
  v_action_href := '/app/' || v_event.household_id::text
    || '/calendar/events/' || p_event_id::text;

  for v_occ in
    select *
    from public.calendar_event_occurrences o
    where o.event_id = p_event_id
      and o.is_cancelled = false
      and o.starts_at > now() - interval '1 day'
  loop
    select * into v_ex
    from public.calendar_event_exceptions x
    where x.event_id = p_event_id
      and x.original_starts_at = v_occ.original_starts_at
      and x.kind = 'override';

    for v_rem in
      select r.offset_minutes, r.recipient_groups
      from (
        select er.offset_minutes, er.recipient_groups
        from public.calendar_event_exception_reminders er
        where v_ex.id is not null
          and v_ex.overrides_reminders
          and er.exception_id = v_ex.id
        union all
        select mr.offset_minutes, mr.recipient_groups
        from public.calendar_event_reminders mr
        where mr.event_id = p_event_id
          and (v_ex.id is null or not coalesce(v_ex.overrides_reminders, false))
      ) r
    loop
      v_fire_at := v_occ.starts_at - make_interval(mins => v_rem.offset_minutes);
      if v_fire_at < now() - interval '1 minute' then
        continue;
      end if;

      select array_agg(distinct u) into v_recipients
      from (
        select v_organizer_user as u
        where 'organizer' = any (v_rem.recipient_groups)
        union
        select public._calendar_user_id_for_membership(a.membership_id) as u
        from (
          select ea.membership_id, ea.rsvp_status
          from public.calendar_event_exception_attendees ea
          where v_ex.id is not null
            and v_ex.overrides_attendees
            and ea.exception_id = v_ex.id
          union all
          select ma.membership_id, ma.rsvp_status
          from public.calendar_event_attendees ma
          where ma.event_id = p_event_id
            and (v_ex.id is null or not coalesce(v_ex.overrides_attendees, false))
        ) a
        where (
          ('going' = any (v_rem.recipient_groups) and a.rsvp_status = 'going')
          or ('maybe' = any (v_rem.recipient_groups) and a.rsvp_status = 'maybe')
          or ('all_invited' = any (v_rem.recipient_groups))
        )
      ) s
      where u is not null;

      if v_recipients is null then
        continue;
      end if;

      foreach v_user_id in array v_recipients loop
        if v_user_id is null then
          continue;
        end if;
        v_idem := 'calendar_occurrence:' || v_occ.id::text || ':' || v_user_id::text
          || ':calendar.reminder:' || v_rem.offset_minutes::text || ':'
          || to_char(v_fire_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');

        perform public._create_scheduled_notification_request(
          'calendar_occurrence',
          v_occ.id,
          v_user_id,
          'calendar.reminder',
          v_fire_at,
          v_event.time_zone,
          v_idem,
          jsonb_build_object(
            'source_type', 'calendar_occurrence',
            'source_id', v_occ.id,
            'event_id', p_event_id,
            'title', 'Upcoming household event',
            'body', 'Open HouseholdOS to review it.',
            'action_href', v_action_href
          )
        );
        v_count := v_count + 1;
      end loop;
    end loop;
  end loop;

  return v_count;
end;
$$;

revoke all on function public._reconcile_calendar_reminders(uuid) from public;
