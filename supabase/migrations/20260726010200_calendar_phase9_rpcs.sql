-- Phase 9: calendar expansion RPCs

-- ---------------------------------------------------------------------------
-- Material-change detection
-- ---------------------------------------------------------------------------
create or replace function public._calendar_material_fields_changed(
  p_before public.calendar_events,
  p_all_day boolean,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_start_date date,
  p_end_date_exclusive date,
  p_location text
)
returns boolean
language plpgsql
immutable
as $$
begin
  if p_before.all_day is distinct from p_all_day then
    return true;
  end if;
  if p_all_day then
    if p_before.start_date is distinct from p_start_date
       or p_before.end_date_exclusive is distinct from p_end_date_exclusive then
      return true;
    end if;
  else
    if p_before.starts_at is distinct from p_starts_at
       or p_before.ends_at is distinct from p_ends_at then
      return true;
    end if;
  end if;
  if coalesce(p_before.location, '') is distinct from coalesce(nullif(trim(coalesce(p_location, p_before.location)), ''), '') then
    -- Only treat explicit location change when p_location is provided (non-null arg path handled by caller)
    null;
  end if;
  if p_location is not null
     and coalesce(p_before.location, '') is distinct from coalesce(nullif(trim(p_location), ''), '') then
    return true;
  end if;
  return false;
end;
$$;

revoke all on function public._calendar_material_fields_changed(
  public.calendar_events, boolean, timestamptz, timestamptz, date, date, text
) from public;

-- ---------------------------------------------------------------------------
-- Patch create_calendar_event to assign calendar_id
-- ---------------------------------------------------------------------------
create or replace function public.create_calendar_event(
  p_household_id uuid,
  p_title text,
  p_description text default null,
  p_location text default null,
  p_category text default 'other',
  p_visibility text default 'household',
  p_all_day boolean default false,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_start_date date default null,
  p_end_date_exclusive date default null,
  p_time_zone text default 'America/Chicago',
  p_rrule text default null,
  p_recurrence_until date default null,
  p_recurrence_count int default null,
  p_event_guest_count int default 0,
  p_guest_label text default null,
  p_attendee_membership_ids uuid[] default '{}',
  p_reminder_offsets_minutes int[] default '{60}',
  p_client_idempotency_key text default null,
  p_calendar_id uuid default null,
  p_meeting_url text default null,
  p_resource_ids uuid[] default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizer uuid;
  v_organizer_user uuid;
  v_event_id uuid;
  v_calendar_uid text;
  v_key text := trim(coalesce(p_client_idempotency_key, ''));
  v_offset int;
  v_mid uuid;
  v_recipients uuid[] := '{}';
  v_invitee_users uuid[];
  v_household_users uuid[];
  v_calendar_id uuid;
  v_resource_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if char_length(v_key) < 8 then
    raise exception 'Idempotency key required';
  end if;

  perform set_config('householdos.calendar_mutation', 'rpc', true);

  if not public.is_active_member(p_household_id) then
    raise exception 'Not an active member of this household';
  end if;

  v_organizer := public._calendar_active_membership(p_household_id);
  v_organizer_user := public._calendar_user_id_for_membership(v_organizer);

  select id into v_event_id
  from public.calendar_events
  where household_id = p_household_id
    and organizer_membership_id = v_organizer
    and client_idempotency_key = v_key;
  if found then
    return v_event_id;
  end if;

  if p_title is null or char_length(trim(p_title)) < 1 then
    raise exception 'Event title is required';
  end if;
  if p_time_zone is null or char_length(trim(p_time_zone)) < 1 then
    raise exception 'Time zone is required';
  end if;
  if p_category is null or p_category not in (
    'household_meeting', 'social', 'shared_meal', 'guest_visit', 'maintenance',
    'cleaning', 'grocery_trip', 'bill_deadline', 'move_in_out', 'personal', 'other',
    'meal_prep'
  ) then
    raise exception 'Invalid event category';
  end if;
  if p_visibility is null or p_visibility not in ('household', 'participants', 'private_busy') then
    raise exception 'Invalid event visibility';
  end if;

  if p_calendar_id is not null then
    if not exists (
      select 1 from public.household_calendars c
      where c.id = p_calendar_id
        and c.household_id = p_household_id
        and c.is_archived = false
    ) then
      raise exception 'Calendar not found in this household';
    end if;
    v_calendar_id := p_calendar_id;
  elsif p_visibility = 'private_busy' then
    select c.id into v_calendar_id
    from public.household_calendars c
    where c.household_id = p_household_id
      and c.calendar_type = 'personal'
      and c.owner_membership_id = v_organizer
      and c.is_archived = false
    limit 1;
  end if;

  if v_calendar_id is null then
    select c.id into v_calendar_id
    from public.household_calendars c
    where c.household_id = p_household_id
      and c.calendar_type = 'household'
      and c.is_archived = false
    limit 1;
  end if;

  if v_calendar_id is null then
    raise exception 'No household calendar available';
  end if;

  if coalesce(p_all_day, false) then
    if p_start_date is null or p_end_date_exclusive is null then
      raise exception 'All-day events require start_date and end_date_exclusive';
    end if;
    if p_end_date_exclusive <= p_start_date then
      raise exception 'end_date_exclusive must be after start_date';
    end if;
  else
    if p_starts_at is null or p_ends_at is null then
      raise exception 'Timed events require starts_at and ends_at';
    end if;
    if p_ends_at <= p_starts_at then
      raise exception 'ends_at must be after starts_at';
    end if;
  end if;

  if p_reminder_offsets_minutes is not null then
    if cardinality(p_reminder_offsets_minutes) > 5 then
      raise exception 'At most 5 reminders are allowed';
    end if;
    foreach v_offset in array p_reminder_offsets_minutes loop
      if v_offset is null or v_offset < 0 or v_offset > 10080 then
        raise exception 'Reminder offsets must be between 0 and 10080 minutes';
      end if;
    end loop;
  end if;

  v_calendar_uid := 'householdos-' || p_household_id::text || '-'
    || gen_random_uuid()::text || '@householdos.app';

  insert into public.calendar_events (
    household_id, calendar_id, organizer_membership_id, title, description, location,
    category, visibility, status, all_day, starts_at, ends_at,
    start_date, end_date_exclusive, time_zone, rrule, recurrence_until,
    recurrence_count, calendar_uid, event_guest_count, guest_label,
    client_idempotency_key, meeting_url, lifecycle_owner, is_editable, is_deletable,
    canonical_deep_link
  ) values (
    p_household_id, v_calendar_id, v_organizer, trim(p_title),
    nullif(trim(coalesce(p_description, '')), ''),
    nullif(trim(coalesce(p_location, '')), ''),
    p_category, p_visibility, 'scheduled', coalesce(p_all_day, false),
    case when coalesce(p_all_day, false) then null else p_starts_at end,
    case when coalesce(p_all_day, false) then null else p_ends_at end,
    case when coalesce(p_all_day, false) then p_start_date else null end,
    case when coalesce(p_all_day, false) then p_end_date_exclusive else null end,
    trim(p_time_zone), nullif(trim(coalesce(p_rrule, '')), ''),
    p_recurrence_until, p_recurrence_count, v_calendar_uid,
    coalesce(p_event_guest_count, 0), nullif(trim(coalesce(p_guest_label, '')), ''),
    v_key,
    nullif(trim(coalesce(p_meeting_url, '')), ''),
    'householdos', true, true,
    null
  )
  returning id into v_event_id;

  update public.calendar_events
  set canonical_deep_link = '/app/' || p_household_id::text || '/calendar/event/' || v_event_id::text
  where id = v_event_id;

  insert into public.calendar_event_attendees (
    event_id, household_id, membership_id, participation_role,
    rsvp_status, responded_at, response_event_sequence, needs_reconfirmation, is_required
  ) values (
    v_event_id, p_household_id, v_organizer, 'organizer', 'going', now(), 0, false, true
  );

  if p_attendee_membership_ids is not null then
    foreach v_mid in array p_attendee_membership_ids loop
      if v_mid is null or v_mid = v_organizer then
        continue;
      end if;
      perform public._calendar_assert_same_household_member(p_household_id, v_mid);
      insert into public.calendar_event_attendees (
        event_id, household_id, membership_id, participation_role, rsvp_status, is_required
      ) values (
        v_event_id, p_household_id, v_mid, 'invitee', 'needs_action', true
      )
      on conflict (event_id, membership_id) do nothing;
    end loop;
  end if;

  if p_reminder_offsets_minutes is not null then
    foreach v_offset in array p_reminder_offsets_minutes loop
      insert into public.calendar_event_reminders (event_id, household_id, offset_minutes)
      values (v_event_id, p_household_id, v_offset)
      on conflict (event_id, offset_minutes) do nothing;
    end loop;
  end if;

  if p_resource_ids is not null then
    foreach v_resource_id in array p_resource_ids loop
      if not exists (
        select 1 from public.calendar_resources r
        where r.id = v_resource_id and r.household_id = p_household_id and r.is_active
      ) then
        raise exception 'Resource not found';
      end if;
      insert into public.calendar_resource_reservations (
        household_id, resource_id, event_id, quantity, confirmed, created_by_membership_id
      ) values (
        p_household_id, v_resource_id, v_event_id, 1, true, v_organizer
      );
    end loop;
  end if;

  perform public._calendar_audit(
    p_household_id, 'calendar_event', v_event_id, 'calendar.event_created',
    null, jsonb_build_object('visibility', p_visibility, 'calendar_id', v_calendar_id),
    null, null
  );

  select array_agg(distinct public._calendar_user_id_for_membership(a.membership_id))
  into v_invitee_users
  from public.calendar_event_attendees a
  where a.event_id = v_event_id
    and a.membership_id <> v_organizer;

  if v_invitee_users is not null and cardinality(v_invitee_users) > 0 then
    perform public._emit_notification_event(
      p_household_id,
      'calendar.invitation',
      'calendar_event',
      v_event_id,
      v_organizer,
      '{}'::jsonb,
      'calendar.invitation:' || v_event_id::text,
      v_invitee_users,
      'Calendar invitation',
      'You were invited to a household calendar event.',
      '/app/' || p_household_id::text || '/calendar/event/' || v_event_id::text
    );
  end if;

  return v_event_id;
end;
$$;

revoke all on function public.create_calendar_event(
  uuid, text, text, text, text, text, boolean, timestamptz, timestamptz, date, date,
  text, text, date, int, int, text, uuid[], int[], text, uuid, text, uuid[]
) from public;
revoke all on function public.create_calendar_event(
  uuid, text, text, text, text, text, boolean, timestamptz, timestamptz, date, date,
  text, text, date, int, int, text, uuid[], int[], text, uuid, text, uuid[]
) from anon;
grant execute on function public.create_calendar_event(
  uuid, text, text, text, text, text, boolean, timestamptz, timestamptz, date, date,
  text, text, date, int, int, text, uuid[], int[], text, uuid, text, uuid[]
) to authenticated;

-- Also keep compatibility with older 20-arg signature by leaving prior overload if needed.
-- Postgres will resolve by arg count; existing callers with 20 args still hit old if present.
-- Drop old overload to avoid ambiguity once new defaults cover them:
drop function if exists public.create_calendar_event(
  uuid, text, text, text, text, text, boolean, timestamptz, timestamptz, date, date,
  text, text, date, int, int, text, uuid[], int[], text
);

-- ---------------------------------------------------------------------------
-- Patch update_calendar_event: material RSVP reconfirmation
-- ---------------------------------------------------------------------------
create or replace function public.update_calendar_event(
  p_event_id uuid,
  p_title text default null,
  p_description text default null,
  p_location text default null,
  p_category text default null,
  p_visibility text default null,
  p_all_day boolean default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_start_date date default null,
  p_end_date_exclusive date default null,
  p_time_zone text default null,
  p_rrule text default null,
  p_recurrence_until date default null,
  p_recurrence_count int default null,
  p_event_guest_count int default null,
  p_guest_label text default null,
  p_attendee_membership_ids uuid[] default null,
  p_reminder_offsets_minutes int[] default null,
  p_coordinator_override boolean default false,
  p_meeting_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.calendar_events%rowtype;
  v_actor uuid;
  v_actor_user uuid := auth.uid();
  v_is_organizer boolean := false;
  v_override boolean := false;
  v_all_day boolean;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_start_date date;
  v_end_date_excl date;
  v_category text;
  v_visibility text;
  v_offset int;
  v_mid uuid;
  v_desired uuid[];
  v_recipients uuid[];
  v_corr uuid := gen_random_uuid();
  v_material boolean := false;
  v_new_seq int;
begin
  if v_actor_user is null then
    raise exception 'Not authenticated';
  end if;

  perform set_config('householdos.calendar_mutation', 'rpc', true);

  select * into v_event from public.calendar_events where id = p_event_id for update;
  if not found then
    raise exception 'Calendar event not found';
  end if;
  if v_event.status <> 'scheduled' then
    raise exception 'Only scheduled events can be updated';
  end if;
  if v_event.is_editable = false then
    raise exception 'This event is not editable from the calendar';
  end if;
  if v_event.lifecycle_owner = 'domain' then
    raise exception 'Domain-backed events must be edited through their source domain';
  end if;

  v_actor := public._calendar_active_membership(v_event.household_id);
  v_is_organizer := (v_actor = v_event.organizer_membership_id);

  if not v_is_organizer then
    if coalesce(p_coordinator_override, false)
       and v_event.visibility = 'household'
       and public.has_responsibility(v_event.household_id, array['household_coordinator']) then
      v_override := true;
    else
      raise exception 'Only the organizer may update this event';
    end if;
  end if;

  v_category := coalesce(p_category, v_event.category);
  v_visibility := coalesce(p_visibility, v_event.visibility);
  v_all_day := coalesce(p_all_day, v_event.all_day);

  if v_all_day then
    v_start_date := coalesce(p_start_date, v_event.start_date);
    v_end_date_excl := coalesce(p_end_date_exclusive, v_event.end_date_exclusive);
    v_starts_at := null;
    v_ends_at := null;
  else
    v_starts_at := coalesce(p_starts_at, v_event.starts_at);
    v_ends_at := coalesce(p_ends_at, v_event.ends_at);
    v_start_date := null;
    v_end_date_excl := null;
  end if;

  v_material := public._calendar_material_fields_changed(
    v_event, v_all_day, v_starts_at, v_ends_at, v_start_date, v_end_date_excl, p_location
  );

  update public.calendar_events
  set title = coalesce(nullif(trim(coalesce(p_title, '')), ''), title),
      description = case when p_description is null then description
                        else nullif(trim(p_description), '') end,
      location = case when p_location is null then location
                     else nullif(trim(p_location), '') end,
      meeting_url = case when p_meeting_url is null then meeting_url
                        else nullif(trim(p_meeting_url), '') end,
      category = v_category,
      visibility = v_visibility,
      all_day = v_all_day,
      starts_at = v_starts_at,
      ends_at = v_ends_at,
      start_date = v_start_date,
      end_date_exclusive = v_end_date_excl,
      time_zone = coalesce(nullif(trim(coalesce(p_time_zone, '')), ''), time_zone),
      rrule = case when p_rrule is null then rrule else nullif(trim(p_rrule), '') end,
      recurrence_until = coalesce(p_recurrence_until, recurrence_until),
      recurrence_count = coalesce(p_recurrence_count, recurrence_count),
      event_guest_count = coalesce(p_event_guest_count, event_guest_count),
      guest_label = case when p_guest_label is null then guest_label
                        else nullif(trim(p_guest_label), '') end,
      sequence = sequence + 1,
      updated_at = now()
  where id = p_event_id
  returning sequence into v_new_seq;

  if v_material then
    update public.calendar_event_attendees
    set needs_reconfirmation = true,
        rsvp_status = case
          when participation_role = 'organizer' then rsvp_status
          when rsvp_status in ('going', 'maybe') then 'needs_action'
          else rsvp_status
        end,
        response_event_sequence = v_new_seq,
        updated_at = now()
    where event_id = p_event_id
      and participation_role <> 'organizer'
      and rsvp_status in ('going', 'maybe', 'needs_action');
  end if;

  if p_attendee_membership_ids is not null then
    v_desired := array[v_event.organizer_membership_id];
    foreach v_mid in array p_attendee_membership_ids loop
      if v_mid is null or v_mid = v_event.organizer_membership_id then
        continue;
      end if;
      perform public._calendar_assert_same_household_member(v_event.household_id, v_mid);
      v_desired := v_desired || v_mid;
      if not exists (
        select 1 from public.calendar_event_attendees a
        where a.event_id = p_event_id and a.membership_id = v_mid
      ) then
        insert into public.calendar_event_attendees (
          event_id, household_id, membership_id, participation_role, rsvp_status, is_required
        ) values (
          p_event_id, v_event.household_id, v_mid, 'invitee', 'needs_action', true
        )
        on conflict (event_id, membership_id) do nothing;
      end if;
    end loop;

    for v_mid in
      select a.membership_id
      from public.calendar_event_attendees a
      where a.event_id = p_event_id
        and a.membership_id <> v_event.organizer_membership_id
        and not (a.membership_id = any (v_desired))
    loop
      delete from public.calendar_event_attendees
      where event_id = p_event_id and membership_id = v_mid;
    end loop;
  end if;

  if p_reminder_offsets_minutes is not null then
    delete from public.calendar_event_reminders where event_id = p_event_id;
    foreach v_offset in array p_reminder_offsets_minutes loop
      insert into public.calendar_event_reminders (event_id, household_id, offset_minutes)
      values (p_event_id, v_event.household_id, v_offset)
      on conflict (event_id, offset_minutes) do nothing;
    end loop;
  end if;

  perform public._calendar_audit(
    v_event.household_id, 'calendar_event', p_event_id, 'calendar.event_updated',
    jsonb_build_object('material', v_material),
    jsonb_build_object('sequence', v_new_seq, 'material', v_material),
    null, v_corr
  );

  select array_agg(distinct u) into v_recipients
  from (
    select public._calendar_user_id_for_membership(a.membership_id) as u
    from public.calendar_event_attendees a
    where a.event_id = p_event_id
  ) s
  where u is not null and u <> v_actor_user;

  if v_recipients is not null and cardinality(v_recipients) > 0 then
    perform public._emit_notification_event(
      v_event.household_id,
      case when v_material then 'calendar.event_requires_reconfirm' else 'calendar.event_updated' end,
      'calendar_event',
      p_event_id,
      v_actor,
      jsonb_build_object('material', v_material),
      'calendar.event_updated:' || p_event_id::text || ':' || v_new_seq::text,
      v_recipients,
      case when v_material then 'Event changed — please reconfirm' else 'Household calendar event updated' end,
      case when v_material
        then 'A calendar event you responded to was changed. Please review your RSVP.'
        else 'A household calendar event was updated.'
      end,
      '/app/' || v_event.household_id::text || '/calendar/event/' || p_event_id::text
    );
  end if;

  return p_event_id;
end;
$$;

drop function if exists public.update_calendar_event(
  uuid, text, text, text, text, text, boolean, timestamptz, timestamptz, date, date,
  text, text, date, int, int, text, uuid[], int[], boolean
);

revoke all on function public.update_calendar_event(
  uuid, text, text, text, text, text, boolean, timestamptz, timestamptz, date, date,
  text, text, date, int, int, text, uuid[], int[], boolean, text
) from public;
grant execute on function public.update_calendar_event(
  uuid, text, text, text, text, text, boolean, timestamptz, timestamptz, date, date,
  text, text, date, int, int, text, uuid[], int[], boolean, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- respond_to_calendar_event: clear reconfirmation + response_note
-- ---------------------------------------------------------------------------
create or replace function public.respond_to_calendar_event(
  p_event_id uuid,
  p_rsvp_status text,
  p_guest_count int default 0,
  p_guest_note text default null,
  p_response_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.calendar_events%rowtype;
  v_actor uuid;
  v_actor_user uuid := auth.uid();
  v_before text;
begin
  if v_actor_user is null then
    raise exception 'Not authenticated';
  end if;
  if p_rsvp_status not in ('needs_action', 'going', 'maybe', 'not_going') then
    raise exception 'Invalid RSVP status';
  end if;

  perform set_config('householdos.calendar_mutation', 'rpc', true);

  select * into v_event from public.calendar_events where id = p_event_id for update;
  if not found then
    raise exception 'Calendar event not found';
  end if;
  if v_event.status <> 'scheduled' then
    raise exception 'Cannot respond to a cancelled event';
  end if;

  v_actor := public._calendar_active_membership(v_event.household_id);

  if not exists (
    select 1 from public.calendar_event_attendees a
    where a.event_id = p_event_id and a.membership_id = v_actor
  ) then
    raise exception 'You are not an invitee of this event';
  end if;

  select rsvp_status into v_before
  from public.calendar_event_attendees
  where event_id = p_event_id and membership_id = v_actor;

  update public.calendar_event_attendees
  set rsvp_status = p_rsvp_status,
      guest_count = coalesce(p_guest_count, 0),
      guest_note = nullif(trim(coalesce(p_guest_note, '')), ''),
      response_note = nullif(trim(coalesce(p_response_note, '')), ''),
      responded_at = now(),
      needs_reconfirmation = false,
      response_event_sequence = v_event.sequence,
      updated_at = now()
  where event_id = p_event_id and membership_id = v_actor;

  perform public._calendar_audit(
    v_event.household_id, 'calendar_event', p_event_id, 'calendar.rsvp_changed',
    jsonb_build_object('rsvp', v_before),
    jsonb_build_object('rsvp', p_rsvp_status),
    null, null
  );

  if v_event.organizer_membership_id <> v_actor then
    perform public._emit_notification_event(
      v_event.household_id,
      'calendar.rsvp_changed',
      'calendar_event',
      p_event_id,
      v_actor,
      '{}'::jsonb,
      'calendar.rsvp_changed:' || p_event_id::text || ':' || v_actor::text || ':' || p_rsvp_status,
      array[public._calendar_user_id_for_membership(v_event.organizer_membership_id)],
      'RSVP updated',
      'An invitee updated their RSVP.',
      '/app/' || v_event.household_id::text || '/calendar/event/' || p_event_id::text
    );
  end if;

  return p_event_id;
end;
$$;

drop function if exists public.respond_to_calendar_event(uuid, text, int, text);

revoke all on function public.respond_to_calendar_event(uuid, text, int, text, text) from public;
grant execute on function public.respond_to_calendar_event(uuid, text, int, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Split series (this and future)
-- ---------------------------------------------------------------------------
create or replace function public.split_calendar_event_series(
  p_event_id uuid,
  p_split_starts_at timestamptz,
  p_client_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.calendar_events%rowtype;
  v_actor uuid;
  v_new_id uuid;
  v_key text := trim(coalesce(p_client_idempotency_key, ''));
  v_until date;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if char_length(v_key) < 8 then
    raise exception 'Idempotency key required';
  end if;
  if p_split_starts_at is null then
    raise exception 'Split start is required';
  end if;

  perform set_config('householdos.calendar_mutation', 'rpc', true);

  select * into v_event from public.calendar_events where id = p_event_id for update;
  if not found then
    raise exception 'Calendar event not found';
  end if;
  if v_event.rrule is null then
    raise exception 'Only recurring events can be split';
  end if;

  v_actor := public._calendar_active_membership(v_event.household_id);
  if v_actor <> v_event.organizer_membership_id then
    raise exception 'Only the organizer may split this series';
  end if;

  select id into v_new_id
  from public.calendar_events
  where household_id = v_event.household_id
    and organizer_membership_id = v_actor
    and client_idempotency_key = v_key;
  if found then
    return v_new_id;
  end if;

  v_until := ((p_split_starts_at at time zone v_event.time_zone)::date - 1);

  update public.calendar_events
  set recurrence_until = v_until,
      recurrence_count = null,
      rrule = case
        when rrule ~* 'UNTIL=' then regexp_replace(rrule, 'UNTIL=[^;]+', 'UNTIL=' || to_char(v_until, 'YYYYMMDD'), 'i')
        when rrule ~* 'COUNT=' then regexp_replace(rrule, 'COUNT=[0-9]+', 'UNTIL=' || to_char(v_until, 'YYYYMMDD'), 'i')
        else rrule || ';UNTIL=' || to_char(v_until, 'YYYYMMDD')
      end,
      sequence = sequence + 1,
      updated_at = now()
  where id = p_event_id;

  -- Move future exceptions to the new series after create
  v_new_id := public.create_calendar_event(
    v_event.household_id,
    v_event.title,
    v_event.description,
    v_event.location,
    v_event.category,
    v_event.visibility,
    v_event.all_day,
    case when v_event.all_day then null else p_split_starts_at end,
    case when v_event.all_day then null else p_split_starts_at + (v_event.ends_at - v_event.starts_at) end,
    case when v_event.all_day then (p_split_starts_at at time zone v_event.time_zone)::date else null end,
    case when v_event.all_day then (p_split_starts_at at time zone v_event.time_zone)::date + (v_event.end_date_exclusive - v_event.start_date) else null end,
    v_event.time_zone,
    regexp_replace(regexp_replace(coalesce(v_event.rrule, ''), ';?UNTIL=[^;]+', '', 'i'), ';?COUNT=[0-9]+', '', 'i'),
    v_event.recurrence_until,
    null,
    v_event.event_guest_count,
    v_event.guest_label,
    array(
      select a.membership_id from public.calendar_event_attendees a
      where a.event_id = p_event_id and a.participation_role <> 'organizer'
    ),
    array(
      select r.offset_minutes from public.calendar_event_reminders r where r.event_id = p_event_id
    ),
    v_key,
    v_event.calendar_id,
    v_event.meeting_url,
    null
  );

  update public.calendar_events
  set series_id = v_event.series_id
  where id = v_new_id;

  delete from public.calendar_event_exceptions
  where event_id = p_event_id
    and original_starts_at >= p_split_starts_at;

  perform public._calendar_audit(
    v_event.household_id, 'calendar_event', p_event_id, 'calendar.series_split',
    null, jsonb_build_object('successor_id', v_new_id, 'split_at', p_split_starts_at),
    null, null
  );

  return v_new_id;
end;
$$;

revoke all on function public.split_calendar_event_series(uuid, timestamptz, text) from public;
grant execute on function public.split_calendar_event_series(uuid, timestamptz, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Availability rules
-- ---------------------------------------------------------------------------
create or replace function public.upsert_calendar_availability_rule(
  p_household_id uuid,
  p_rule_kind text,
  p_weekdays smallint[],
  p_start_minute smallint,
  p_end_minute smallint,
  p_time_zone text default 'America/Chicago',
  p_min_notice_minutes int default 0,
  p_max_event_minutes int default null,
  p_rule_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_id uuid;
begin
  perform set_config('householdos.calendar_mutation', 'rpc', true);
  v_actor := public._calendar_active_membership(p_household_id);

  if p_rule_kind not in ('available', 'preferred', 'unavailable', 'busy_only') then
    raise exception 'Invalid rule kind';
  end if;

  if p_rule_id is not null then
    update public.calendar_availability_rules
    set rule_kind = p_rule_kind,
        weekdays = p_weekdays,
        start_minute = p_start_minute,
        end_minute = p_end_minute,
        time_zone = coalesce(nullif(trim(p_time_zone), ''), time_zone),
        min_notice_minutes = coalesce(p_min_notice_minutes, 0),
        max_event_minutes = p_max_event_minutes,
        updated_at = now()
    where id = p_rule_id
      and membership_id = v_actor
      and household_id = p_household_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Availability rule not found';
    end if;
    return v_id;
  end if;

  insert into public.calendar_availability_rules (
    household_id, membership_id, rule_kind, weekdays, start_minute, end_minute,
    time_zone, min_notice_minutes, max_event_minutes
  ) values (
    p_household_id, v_actor, p_rule_kind, p_weekdays, p_start_minute, p_end_minute,
    coalesce(nullif(trim(p_time_zone), ''), 'America/Chicago'),
    coalesce(p_min_notice_minutes, 0), p_max_event_minutes
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.upsert_calendar_availability_rule(
  uuid, text, smallint[], smallint, smallint, text, int, int, uuid
) from public;
grant execute on function public.upsert_calendar_availability_rule(
  uuid, text, smallint[], smallint, smallint, text, int, int, uuid
) to authenticated;

create or replace function public.create_calendar_availability_override(
  p_household_id uuid,
  p_override_kind text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_id uuid;
begin
  perform set_config('householdos.calendar_mutation', 'rpc', true);
  v_actor := public._calendar_active_membership(p_household_id);
  if p_override_kind not in ('available', 'unavailable', 'private_block') then
    raise exception 'Invalid override kind';
  end if;
  if p_ends_at <= p_starts_at then
    raise exception 'Override end must be after start';
  end if;
  insert into public.calendar_availability_overrides (
    household_id, membership_id, override_kind, starts_at, ends_at, note
  ) values (
    p_household_id, v_actor, p_override_kind, p_starts_at, p_ends_at,
    nullif(trim(coalesce(p_note, '')), '')
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.create_calendar_availability_override(
  uuid, text, timestamptz, timestamptz, text
) from public;
grant execute on function public.create_calendar_availability_override(
  uuid, text, timestamptz, timestamptz, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- Resources
-- ---------------------------------------------------------------------------
create or replace function public.create_calendar_resource(
  p_household_id uuid,
  p_name text,
  p_resource_kind text default 'generic',
  p_capacity_mode text default 'exclusive',
  p_capacity int default 1
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_id uuid;
begin
  perform set_config('householdos.calendar_mutation', 'rpc', true);
  v_actor := public._calendar_active_membership(p_household_id);
  if not public.has_responsibility(p_household_id, array['household_coordinator']) then
    -- members may create simple resources; coordinators always can
    null;
  end if;
  insert into public.calendar_resources (
    household_id, name, resource_kind, capacity_mode, capacity
  ) values (
    p_household_id, trim(p_name), coalesce(p_resource_kind, 'generic'),
    coalesce(p_capacity_mode, 'exclusive'), coalesce(p_capacity, 1)
  )
  returning id into v_id;
  perform public._calendar_audit(
    p_household_id, 'calendar_resource', v_id, 'calendar.resource_created',
    null, jsonb_build_object('name', trim(p_name)), null, null
  );
  return v_id;
end;
$$;

revoke all on function public.create_calendar_resource(uuid, text, text, text, int) from public;
grant execute on function public.create_calendar_resource(uuid, text, text, text, int) to authenticated;

create or replace function public.reserve_calendar_resource(
  p_event_id uuid,
  p_resource_id uuid,
  p_quantity int default 1,
  p_confirmed boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.calendar_events%rowtype;
  v_resource public.calendar_resources%rowtype;
  v_actor uuid;
  v_id uuid;
  v_used int;
begin
  perform set_config('householdos.calendar_mutation', 'rpc', true);
  select * into v_event from public.calendar_events where id = p_event_id for update;
  if not found then
    raise exception 'Event not found';
  end if;
  v_actor := public._calendar_active_membership(v_event.household_id);
  if v_actor <> v_event.organizer_membership_id
     and not public.has_responsibility(v_event.household_id, array['household_coordinator']) then
    raise exception 'Only the organizer may reserve resources for this event';
  end if;

  select * into v_resource from public.calendar_resources
  where id = p_resource_id and household_id = v_event.household_id and is_active;
  if not found then
    raise exception 'Resource not found';
  end if;

  if v_resource.capacity_mode = 'exclusive' then
    if exists (
      select 1
      from public.calendar_resource_reservations rr
      join public.calendar_event_occurrences o on o.event_id = rr.event_id
      join public.calendar_event_occurrences o2 on o2.event_id = p_event_id
      where rr.resource_id = p_resource_id
        and rr.event_id <> p_event_id
        and rr.confirmed
        and o.is_cancelled = false
        and o2.is_cancelled = false
        and tstzrange(o.starts_at, o.ends_at, '[)') && tstzrange(o2.starts_at, o2.ends_at, '[)')
    ) then
      insert into public.calendar_event_conflicts (
        household_id, event_id, resource_id, conflict_class, conflict_kind, summary
      ) values (
        v_event.household_id, p_event_id, p_resource_id, 'hard', 'resource_exclusive',
        'Exclusive resource already reserved for an overlapping event'
      );
      raise exception 'Exclusive resource conflict';
    end if;
  else
    select coalesce(sum(rr.quantity), 0) into v_used
    from public.calendar_resource_reservations rr
    join public.calendar_event_occurrences o on o.event_id = rr.event_id
    join public.calendar_event_occurrences o2 on o2.event_id = p_event_id
    where rr.resource_id = p_resource_id
      and rr.event_id <> p_event_id
      and rr.confirmed
      and o.is_cancelled = false
      and o2.is_cancelled = false
      and tstzrange(o.starts_at, o.ends_at, '[)') && tstzrange(o2.starts_at, o2.ends_at, '[)');
    if v_used + coalesce(p_quantity, 1) > v_resource.capacity then
      raise exception 'Resource capacity exceeded';
    end if;
  end if;

  insert into public.calendar_resource_reservations (
    household_id, resource_id, event_id, quantity, confirmed, created_by_membership_id
  ) values (
    v_event.household_id, p_resource_id, p_event_id, coalesce(p_quantity, 1),
    coalesce(p_confirmed, true), v_actor
  )
  on conflict (resource_id, event_id) do update
    set quantity = excluded.quantity, confirmed = excluded.confirmed
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.reserve_calendar_resource(uuid, uuid, int, boolean) from public;
grant execute on function public.reserve_calendar_resource(uuid, uuid, int, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Record conflict (soft detection from app)
-- ---------------------------------------------------------------------------
create or replace function public.record_calendar_event_conflict(
  p_event_id uuid,
  p_conflicting_event_id uuid,
  p_conflict_class text,
  p_conflict_kind text,
  p_summary text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.calendar_events%rowtype;
  v_actor uuid;
  v_id uuid;
begin
  perform set_config('householdos.calendar_mutation', 'rpc', true);
  select * into v_event from public.calendar_events where id = p_event_id;
  if not found then
    raise exception 'Event not found';
  end if;
  v_actor := public._calendar_active_membership(v_event.household_id);
  insert into public.calendar_event_conflicts (
    household_id, event_id, conflicting_event_id, conflict_class, conflict_kind, summary
  ) values (
    v_event.household_id, p_event_id, p_conflicting_event_id,
    p_conflict_class, p_conflict_kind, trim(p_summary)
  )
  on conflict (event_id, conflicting_event_id, conflict_kind) do update
    set summary = excluded.summary,
        conflict_class = excluded.conflict_class,
        is_resolved = false
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.record_calendar_event_conflict(
  uuid, uuid, text, text, text
) from public;
grant execute on function public.record_calendar_event_conflict(
  uuid, uuid, text, text, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- External connections (ciphertext never selected by clients via RPC return)
-- ---------------------------------------------------------------------------
create or replace function public.register_calendar_external_connection(
  p_household_id uuid,
  p_provider text,
  p_account_email text,
  p_refresh_token_ciphertext text,
  p_refresh_token_nonce text,
  p_scopes text[],
  p_sync_mode text default 'import_only'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  perform set_config('householdos.calendar_mutation', 'rpc', true);
  perform public._calendar_active_membership(p_household_id);

  if p_provider not in ('google', 'ics_import', 'lifeos') then
    raise exception 'Invalid provider';
  end if;

  insert into public.calendar_external_connections (
    household_id, owner_user_id, provider, account_email,
    refresh_token_ciphertext, refresh_token_nonce, scopes, sync_mode, status
  ) values (
    p_household_id, auth.uid(), p_provider,
    nullif(trim(coalesce(p_account_email, '')), ''),
    p_refresh_token_ciphertext, p_refresh_token_nonce,
    coalesce(p_scopes, '{}'::text[]), coalesce(p_sync_mode, 'import_only'), 'active'
  )
  on conflict (owner_user_id, household_id, provider, account_email) do update
    set refresh_token_ciphertext = excluded.refresh_token_ciphertext,
        refresh_token_nonce = excluded.refresh_token_nonce,
        scopes = excluded.scopes,
        sync_mode = excluded.sync_mode,
        status = 'active',
        revoked_at = null,
        updated_at = now()
  returning id into v_id;

  perform public._calendar_audit(
    p_household_id, 'calendar_external_connection', v_id, 'calendar.external_connected',
    null, jsonb_build_object('provider', p_provider), null, null
  );
  return v_id;
end;
$$;

revoke all on function public.register_calendar_external_connection(
  uuid, text, text, text, text, text[], text
) from public;
grant execute on function public.register_calendar_external_connection(
  uuid, text, text, text, text, text[], text
) to authenticated;

create or replace function public.revoke_calendar_external_connection(p_connection_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conn public.calendar_external_connections%rowtype;
begin
  perform set_config('householdos.calendar_mutation', 'rpc', true);
  select * into v_conn from public.calendar_external_connections where id = p_connection_id for update;
  if not found then
    raise exception 'Connection not found';
  end if;
  if v_conn.owner_user_id <> auth.uid() then
    raise exception 'Only the connection owner may revoke it';
  end if;
  update public.calendar_external_connections
  set status = 'revoked',
      revoked_at = now(),
      refresh_token_ciphertext = null,
      refresh_token_nonce = null,
      updated_at = now()
  where id = p_connection_id;
  perform public._calendar_audit(
    v_conn.household_id, 'calendar_external_connection', p_connection_id,
    'calendar.external_revoked', null, '{}'::jsonb, null, null
  );
end;
$$;

revoke all on function public.revoke_calendar_external_connection(uuid) from public;
grant execute on function public.revoke_calendar_external_connection(uuid) to authenticated;

create or replace function public.enqueue_calendar_sync_run(
  p_connection_id uuid,
  p_trigger_kind text default 'manual'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conn public.calendar_external_connections%rowtype;
  v_id uuid;
begin
  perform set_config('householdos.calendar_mutation', 'rpc', true);
  select * into v_conn from public.calendar_external_connections where id = p_connection_id;
  if not found then
    raise exception 'Connection not found';
  end if;
  if v_conn.owner_user_id <> auth.uid() and auth.role() <> 'service_role' then
    raise exception 'Not authorized';
  end if;
  insert into public.calendar_sync_runs (
    connection_id, household_id, trigger_kind, status, next_attempt_at
  ) values (
    p_connection_id, v_conn.household_id, coalesce(p_trigger_kind, 'manual'), 'queued', now()
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.enqueue_calendar_sync_run(uuid, text) from public;
grant execute on function public.enqueue_calendar_sync_run(uuid, text) to authenticated;
grant execute on function public.enqueue_calendar_sync_run(uuid, text) to service_role;

create or replace function public.claim_calendar_sync_runs(p_limit int default 5)
returns setof public.calendar_sync_runs
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service_role required';
  end if;
  perform set_config('householdos.calendar_mutation', 'rpc', true);
  return query
  with claimed as (
    select r.id
    from public.calendar_sync_runs r
    where r.status in ('queued', 'failed')
      and (r.next_attempt_at is null or r.next_attempt_at <= now())
      and r.attempt_count < 8
    order by r.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 5), 20))
  )
  update public.calendar_sync_runs r
  set status = 'running',
      claimed_at = now(),
      started_at = coalesce(r.started_at, now()),
      attempt_count = r.attempt_count + 1
  from claimed c
  where r.id = c.id
  returning r.*;
end;
$$;

revoke all on function public.claim_calendar_sync_runs(int) from public;
grant execute on function public.claim_calendar_sync_runs(int) to service_role;

-- Privileged helper for worker to read sealed tokens
create or replace function public._calendar_connection_secrets(p_connection_id uuid)
returns table (
  connection_id uuid,
  refresh_token_ciphertext text,
  refresh_token_nonce text,
  provider text,
  household_id uuid,
  owner_user_id uuid,
  sync_mode text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service_role required';
  end if;
  return query
  select c.id, c.refresh_token_ciphertext, c.refresh_token_nonce,
         c.provider, c.household_id, c.owner_user_id, c.sync_mode
  from public.calendar_external_connections c
  where c.id = p_connection_id
    and c.status = 'active';
end;
$$;

revoke all on function public._calendar_connection_secrets(uuid) from public;
grant execute on function public._calendar_connection_secrets(uuid) to service_role;

-- ICS import UID registration
create or replace function public.register_calendar_ics_import(
  p_household_id uuid,
  p_calendar_id uuid,
  p_ics_uid text,
  p_event_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_existing uuid;
begin
  perform set_config('householdos.calendar_mutation', 'rpc', true);
  perform public._calendar_active_membership(p_household_id);

  select event_id into v_existing
  from public.calendar_ics_import_uids
  where household_id = p_household_id
    and calendar_id = p_calendar_id
    and ics_uid = p_ics_uid;
  if found then
    return v_existing;
  end if;

  insert into public.calendar_ics_import_uids (
    household_id, calendar_id, ics_uid, event_id
  ) values (
    p_household_id, p_calendar_id, trim(p_ics_uid), p_event_id
  )
  returning id into v_id;
  return p_event_id;
end;
$$;

revoke all on function public.register_calendar_ics_import(uuid, uuid, text, uuid) from public;
grant execute on function public.register_calendar_ics_import(uuid, uuid, text, uuid) to authenticated;
