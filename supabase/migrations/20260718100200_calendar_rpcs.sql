-- Phase 4: shared household calendar RPCs (events, attendees, reminders, RSVP)
-- All calendar writes flow through SECURITY DEFINER RPCs; organizer identity is
-- always derived from auth.uid(), never from the client. Notification titles are
-- deliberately generic to avoid leaking private event details.

-- ---------------------------------------------------------------------------
-- Audit helper (mirrors _payment_audit): actor is auth.uid()
-- ---------------------------------------------------------------------------
create or replace function public._calendar_audit(
  p_household_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_event_type text,
  p_before_state jsonb default null,
  p_after_state jsonb default null,
  p_reason text default null,
  p_correlation_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_events (
    household_id, actor_user_id, entity_type, entity_id, event_type,
    before_state, after_state, reason, correlation_id
  ) values (
    p_household_id, auth.uid(), p_entity_type, p_entity_id, p_event_type,
    p_before_state, p_after_state, p_reason, coalesce(p_correlation_id, gen_random_uuid())
  );
end;
$$;

revoke all on function public._calendar_audit(uuid, text, uuid, text, jsonb, jsonb, text, uuid) from public;

-- ---------------------------------------------------------------------------
-- Membership helpers
-- ---------------------------------------------------------------------------
create or replace function public._calendar_active_membership(p_household_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  v_id := public.current_membership_id(p_household_id);
  if v_id is null then
    raise exception 'Active membership required for this household';
  end if;
  return v_id;
end;
$$;

revoke all on function public._calendar_active_membership(uuid) from public;

create or replace function public._calendar_user_id_for_membership(p_membership_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select user_id from public.household_memberships where id = p_membership_id;
$$;

revoke all on function public._calendar_user_id_for_membership(uuid) from public;

create or replace function public._calendar_assert_same_household_member(
  p_household_id uuid,
  p_membership_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.household_memberships m
    where m.id = p_membership_id
      and m.household_id = p_household_id
      and m.status = 'active'
  ) then
    raise exception 'Attendee % is not an active member of this household', p_membership_id;
  end if;
end;
$$;

revoke all on function public._calendar_assert_same_household_member(uuid, uuid) from public;

-- ---------------------------------------------------------------------------
-- Extend write_audit_event allowlist with calendar events
-- (full copy of the Phase 3 allowlist + calendar additions)
-- ---------------------------------------------------------------------------
create or replace function public.write_audit_event(
  p_household_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_event_type text,
  p_before_state jsonb default null,
  p_after_state jsonb default null,
  p_reason text default null,
  p_correlation_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_allowed text[] := array[
    'household.updated',
    'household.settings_updated',
    'profile.recovered',
    'membership.status_changed',
    'membership.roles_changed',
    'invitation.created',
    'invitation.accepted',
    'invitation.declined',
    'invitation.revoked',
    'household.created',
    'household.archived',
    'expense.created',
    'expense.submitted_for_review',
    'expense.confirmed',
    'expense.amendment_created',
    'expense.amended',
    'expense.voided',
    'expense.draft_deleted',
    'reimbursement.created',
    'reimbursement.adjusted',
    'reimbursement.reversed',
    'reimbursement.waived',
    'reimbursement.partially_settled',
    'reimbursement.settled',
    'reimbursement.reopened',
    'payment.created',
    'payment.submitted',
    'payment.confirmed',
    'payment.rejected',
    'payment.cancelled',
    'payment.reversed',
    'payment.allocation_created',
    'waiver.reversed',
    'dispute.opened',
    'dispute.resolved',
    'dispute.withdrawn',
    'refund_obligation.created',
    'calendar.event_created',
    'calendar.event_updated',
    'calendar.event_cancelled',
    'calendar.occurrence_updated',
    'calendar.occurrence_cancelled',
    'calendar.attendee_added',
    'calendar.attendee_removed',
    'calendar.rsvp_changed',
    'calendar.feed_created',
    'calendar.feed_revoked',
    'calendar.feed_regenerated',
    'calendar.coordinator_override'
  ];
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_entity_type is null or char_length(trim(p_entity_type)) < 1 then
    raise exception 'Invalid entity type';
  end if;
  if p_entity_id is null then
    raise exception 'Invalid entity id';
  end if;
  if p_event_type is null or not (p_event_type = any (v_allowed)) then
    raise exception 'Event type not permitted';
  end if;
  if p_household_id is not null and not public.is_active_member(p_household_id) then
    raise exception 'Not an active member of this household';
  end if;
  if coalesce(p_before_state::text, '') ~* '(password|token_hash|secret|service_role)'
     or coalesce(p_after_state::text, '') ~* '(password|token_hash|secret|service_role)' then
    raise exception 'Audit payload contains forbidden fields';
  end if;

  insert into public.audit_events (
    household_id, actor_user_id, entity_type, entity_id, event_type,
    before_state, after_state, reason, correlation_id
  ) values (
    p_household_id, v_user_id, p_entity_type, p_entity_id, p_event_type,
    p_before_state, p_after_state, p_reason, coalesce(p_correlation_id, gen_random_uuid())
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_calendar_event
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
  p_client_idempotency_key text default null
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

  -- Organizer is always derived from the authenticated membership.
  v_organizer := public._calendar_active_membership(p_household_id);
  v_organizer_user := public._calendar_user_id_for_membership(v_organizer);

  -- Idempotent replay.
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
    'cleaning', 'grocery_trip', 'bill_deadline', 'move_in_out', 'personal', 'other'
  ) then
    raise exception 'Invalid event category';
  end if;
  if p_visibility is null or p_visibility not in ('household', 'participants', 'private_busy') then
    raise exception 'Invalid event visibility';
  end if;
  if p_event_guest_count is null or p_event_guest_count < 0 or p_event_guest_count > 20 then
    raise exception 'Invalid guest count';
  end if;

  -- Time mode XOR: timed vs all-day, matching schema check constraint.
  if coalesce(p_all_day, false) then
    if p_start_date is null or p_end_date_exclusive is null then
      raise exception 'All-day events require start_date and end_date_exclusive';
    end if;
    if p_end_date_exclusive <= p_start_date then
      raise exception 'end_date_exclusive must be after start_date';
    end if;
    if p_starts_at is not null or p_ends_at is not null then
      raise exception 'All-day events must not supply timed start/end';
    end if;
  else
    if p_starts_at is null or p_ends_at is null then
      raise exception 'Timed events require starts_at and ends_at';
    end if;
    if p_ends_at <= p_starts_at then
      raise exception 'ends_at must be after starts_at';
    end if;
    if p_start_date is not null or p_end_date_exclusive is not null then
      raise exception 'Timed events must not supply all-day dates';
    end if;
  end if;

  -- Reminder validation: at most 5, offsets within 0..10080 minutes (7 days).
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
    household_id, organizer_membership_id, title, description, location,
    category, visibility, status, all_day, starts_at, ends_at,
    start_date, end_date_exclusive, time_zone, rrule, recurrence_until,
    recurrence_count, calendar_uid, event_guest_count, guest_label,
    client_idempotency_key
  ) values (
    p_household_id, v_organizer, trim(p_title),
    nullif(trim(coalesce(p_description, '')), ''),
    nullif(trim(coalesce(p_location, '')), ''),
    p_category, p_visibility, 'scheduled', coalesce(p_all_day, false),
    p_starts_at, p_ends_at, p_start_date, p_end_date_exclusive,
    trim(p_time_zone), nullif(trim(coalesce(p_rrule, '')), ''),
    p_recurrence_until, p_recurrence_count, v_calendar_uid,
    p_event_guest_count, nullif(trim(coalesce(p_guest_label, '')), ''),
    v_key
  )
  returning id into v_event_id;

  -- Organizer attendee (accepted by definition).
  insert into public.calendar_event_attendees (
    event_id, household_id, membership_id, participation_role,
    rsvp_status, responded_at
  ) values (
    v_event_id, p_household_id, v_organizer, 'organizer', 'going', now()
  );

  -- Other invitees (active members of the same household only).
  if p_attendee_membership_ids is not null then
    foreach v_mid in array p_attendee_membership_ids loop
      if v_mid is null or v_mid = v_organizer then
        continue;
      end if;
      perform public._calendar_assert_same_household_member(p_household_id, v_mid);
      insert into public.calendar_event_attendees (
        event_id, household_id, membership_id, participation_role, rsvp_status
      ) values (
        v_event_id, p_household_id, v_mid, 'invitee', 'needs_action'
      )
      on conflict (event_id, membership_id) do nothing;
    end loop;
  end if;

  -- Reminder templates (dedupe on offset).
  if p_reminder_offsets_minutes is not null then
    foreach v_offset in array p_reminder_offsets_minutes loop
      insert into public.calendar_event_reminders (
        event_id, household_id, offset_minutes
      ) values (
        v_event_id, p_household_id, v_offset
      )
      on conflict (event_id, offset_minutes) do nothing;
    end loop;
  end if;

  -- Audit with a minimal payload (no description / guest notes).
  perform public._calendar_audit(
    p_household_id, 'calendar_event', v_event_id, 'calendar.event_created',
    null,
    jsonb_build_object(
      'category', p_category,
      'visibility', p_visibility,
      'all_day', coalesce(p_all_day, false)
    ),
    null, null
  );

  -- Build notification recipients (never the organizer).
  select array_agg(distinct u) into v_invitee_users
  from (
    select public._calendar_user_id_for_membership(mid) as u
    from unnest(coalesce(p_attendee_membership_ids, '{}'::uuid[])) as mid
    where mid is distinct from v_organizer
  ) s
  where u is not null;

  v_recipients := coalesce(v_invitee_users, '{}');

  -- Household-visible, non-personal events also inform other active members.
  if p_visibility = 'household' and p_category <> 'personal' then
    select array_agg(distinct m.user_id) into v_household_users
    from public.household_memberships m
    where m.household_id = p_household_id
      and m.status = 'active'
      and m.id <> v_organizer;
    v_recipients := (
      select array_agg(distinct x)
      from unnest(v_recipients || coalesce(v_household_users, '{}')) x
      where x is not null
    );
  end if;

  -- private_busy never fans out to the household; only explicit invitees remain.
  v_recipients := (
    select array_agg(distinct x)
    from unnest(coalesce(v_recipients, '{}')) x
    where x is not null and x <> v_organizer_user
  );

  if v_recipients is not null and cardinality(v_recipients) > 0 then
    perform public._emit_notification_event(
      p_household_id,
      'calendar.event_created',
      'calendar_event',
      v_event_id,
      v_organizer,
      '{}'::jsonb,
      'calendar.event_created:' || v_event_id::text,
      v_recipients,
      'Household calendar event',
      'A new event was added to the household calendar.',
      '/app/' || p_household_id::text || '/calendar/events/' || v_event_id::text
    );
  end if;

  return v_event_id;
end;
$$;

revoke all on function public.create_calendar_event(uuid, text, text, text, text, text, boolean, timestamptz, timestamptz, date, date, text, text, date, int, int, text, uuid[], int[], text) from public;
revoke all on function public.create_calendar_event(uuid, text, text, text, text, text, boolean, timestamptz, timestamptz, date, date, text, text, date, int, int, text, uuid[], int[], text) from anon;
grant execute on function public.create_calendar_event(uuid, text, text, text, text, text, boolean, timestamptz, timestamptz, date, date, text, text, date, int, int, text, uuid[], int[], text) to authenticated;

-- ---------------------------------------------------------------------------
-- respond_to_calendar_event (RSVP on own attendee row)
-- ---------------------------------------------------------------------------
create or replace function public.respond_to_calendar_event(
  p_event_id uuid,
  p_rsvp_status text,
  p_guest_count int default 0,
  p_guest_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.calendar_events%rowtype;
  v_attendee public.calendar_event_attendees%rowtype;
  v_actor uuid;
  v_organizer_user uuid;
  v_guest_count int := coalesce(p_guest_count, 0);
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_rsvp_status is null or p_rsvp_status not in ('needs_action', 'going', 'maybe', 'not_going') then
    raise exception 'Invalid RSVP status';
  end if;
  if v_guest_count < 0 or v_guest_count > 20 then
    raise exception 'Guest count must be between 0 and 20';
  end if;

  perform set_config('householdos.calendar_mutation', 'rpc', true);

  select * into v_event from public.calendar_events where id = p_event_id;
  if not found then
    raise exception 'Calendar event not found';
  end if;
  if v_event.status <> 'scheduled' then
    raise exception 'Cannot RSVP to a cancelled event';
  end if;

  v_actor := public._calendar_active_membership(v_event.household_id);

  select a.* into v_attendee
  from public.calendar_event_attendees a
  where a.event_id = p_event_id
    and a.membership_id = v_actor
  for update;
  if not found then
    raise exception 'You are not an attendee of this event';
  end if;

  -- Headcount only counts for going/maybe; store what the caller sends.
  update public.calendar_event_attendees
  set rsvp_status = p_rsvp_status,
      guest_count = v_guest_count,
      guest_note = nullif(trim(coalesce(p_guest_note, '')), ''),
      responded_at = now(),
      updated_at = now()
  where id = v_attendee.id;

  perform public._calendar_audit(
    v_event.household_id, 'calendar_event', p_event_id, 'calendar.rsvp_changed',
    jsonb_build_object('rsvp_status', v_attendee.rsvp_status),
    jsonb_build_object('rsvp_status', p_rsvp_status, 'guest_count', v_guest_count),
    null, null
  );

  -- Notify the organizer (never self).
  v_organizer_user := public._calendar_user_id_for_membership(v_event.organizer_membership_id);
  if v_organizer_user is not null and v_organizer_user <> auth.uid() then
    perform public._emit_notification_event(
      v_event.household_id,
      'calendar.rsvp_changed',
      'calendar_event',
      p_event_id,
      v_actor,
      '{}'::jsonb,
      'calendar.rsvp_changed:' || p_event_id::text || ':' || v_actor::text || ':'
        || floor(extract(epoch from now()))::bigint::text,
      array[v_organizer_user],
      'RSVP updated',
      'A household member updated their RSVP for a calendar event.',
      '/app/' || v_event.household_id::text || '/calendar/events/' || p_event_id::text
    );
  end if;

  return p_event_id;
end;
$$;

revoke all on function public.respond_to_calendar_event(uuid, text, int, text) from public;
revoke all on function public.respond_to_calendar_event(uuid, text, int, text) from anon;
grant execute on function public.respond_to_calendar_event(uuid, text, int, text) to authenticated;

-- ---------------------------------------------------------------------------
-- cancel_calendar_event
-- ---------------------------------------------------------------------------
create or replace function public.cancel_calendar_event(
  p_event_id uuid,
  p_reason text default null,
  p_coordinator_override boolean default false
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
  v_corr uuid := gen_random_uuid();
  v_recipients uuid[];
begin
  if v_actor_user is null then
    raise exception 'Not authenticated';
  end if;

  perform set_config('householdos.calendar_mutation', 'rpc', true);

  select * into v_event from public.calendar_events where id = p_event_id for update;
  if not found then
    raise exception 'Calendar event not found';
  end if;
  if v_event.status = 'cancelled' then
    return p_event_id;
  end if;

  v_actor := public._calendar_active_membership(v_event.household_id);
  v_is_organizer := (v_actor = v_event.organizer_membership_id);

  if not v_is_organizer then
    -- Coordinator override is only ever permitted on household-visible events,
    -- never on private_busy or participants-only events.
    if coalesce(p_coordinator_override, false)
       and v_event.visibility = 'household'
       and public.has_responsibility(v_event.household_id, array['household_coordinator']) then
      v_override := true;
    else
      raise exception 'Only the organizer may cancel this event';
    end if;
  end if;

  update public.calendar_events
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by_membership_id = v_actor,
      cancellation_reason = nullif(trim(coalesce(p_reason, '')), ''),
      sequence = sequence + 1,
      updated_at = now()
  where id = p_event_id;

  -- Cancel any future scheduled reminders tied to this event's occurrences.
  update public.scheduled_notification_requests
  set cancelled_at = now(), updated_at = now()
  where source_type = 'calendar_occurrence'
    and source_id in (
      select o.id from public.calendar_event_occurrences o where o.event_id = p_event_id
    )
    and processed_at is null
    and cancelled_at is null;

  if v_override then
    perform public._calendar_audit(
      v_event.household_id, 'calendar_event', p_event_id, 'calendar.coordinator_override',
      null,
      jsonb_build_object('action', 'cancel', 'visibility', v_event.visibility),
      nullif(trim(coalesce(p_reason, '')), ''), v_corr
    );
  end if;

  perform public._calendar_audit(
    v_event.household_id, 'calendar_event', p_event_id, 'calendar.event_cancelled',
    jsonb_build_object('status', 'scheduled'),
    jsonb_build_object('status', 'cancelled', 'coordinator_override', v_override),
    nullif(trim(coalesce(p_reason, '')), ''), v_corr
  );

  -- Notify attendees (except the actor).
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
      'calendar.event_cancelled',
      'calendar_event',
      p_event_id,
      v_actor,
      '{}'::jsonb,
      'calendar.event_cancelled:' || p_event_id::text,
      v_recipients,
      'Event cancelled',
      'A household calendar event was cancelled.',
      '/app/' || v_event.household_id::text || '/calendar/events/' || p_event_id::text
    );
  end if;

  return p_event_id;
end;
$$;

revoke all on function public.cancel_calendar_event(uuid, text, boolean) from public;
revoke all on function public.cancel_calendar_event(uuid, text, boolean) from anon;
grant execute on function public.cancel_calendar_event(uuid, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- update_calendar_event (series / master fields; occurrences reconciled by TS)
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
  p_coordinator_override boolean default false
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
  if v_category not in (
    'household_meeting', 'social', 'shared_meal', 'guest_visit', 'maintenance',
    'cleaning', 'grocery_trip', 'bill_deadline', 'move_in_out', 'personal', 'other'
  ) then
    raise exception 'Invalid event category';
  end if;

  v_visibility := coalesce(p_visibility, v_event.visibility);
  if v_visibility not in ('household', 'participants', 'private_busy') then
    raise exception 'Invalid event visibility';
  end if;

  -- Resolve final time-mode consistent with the schema XOR check.
  v_all_day := coalesce(p_all_day, v_event.all_day);
  if v_all_day then
    v_start_date := coalesce(p_start_date, v_event.start_date);
    v_end_date_excl := coalesce(p_end_date_exclusive, v_event.end_date_exclusive);
    v_starts_at := null;
    v_ends_at := null;
    if v_start_date is null or v_end_date_excl is null then
      raise exception 'All-day events require start_date and end_date_exclusive';
    end if;
    if v_end_date_excl <= v_start_date then
      raise exception 'end_date_exclusive must be after start_date';
    end if;
  else
    v_starts_at := coalesce(p_starts_at, v_event.starts_at);
    v_ends_at := coalesce(p_ends_at, v_event.ends_at);
    v_start_date := null;
    v_end_date_excl := null;
    if v_starts_at is null or v_ends_at is null then
      raise exception 'Timed events require starts_at and ends_at';
    end if;
    if v_ends_at <= v_starts_at then
      raise exception 'ends_at must be after starts_at';
    end if;
  end if;

  if p_event_guest_count is not null and (p_event_guest_count < 0 or p_event_guest_count > 20) then
    raise exception 'Invalid guest count';
  end if;

  update public.calendar_events
  set title = coalesce(nullif(trim(coalesce(p_title, '')), ''), title),
      description = case when p_description is null then description
                        else nullif(trim(p_description), '') end,
      location = case when p_location is null then location
                     else nullif(trim(p_location), '') end,
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
  where id = p_event_id;

  -- Reconcile attendees when a desired set is provided (organizer stays put).
  if p_attendee_membership_ids is not null then
    v_desired := array[v_event.organizer_membership_id];
    foreach v_mid in array p_attendee_membership_ids loop
      if v_mid is null or v_mid = v_event.organizer_membership_id then
        continue;
      end if;
      perform public._calendar_assert_same_household_member(v_event.household_id, v_mid);
      v_desired := v_desired || v_mid;
      -- Add newcomers.
      if not exists (
        select 1 from public.calendar_event_attendees a
        where a.event_id = p_event_id and a.membership_id = v_mid
      ) then
        insert into public.calendar_event_attendees (
          event_id, household_id, membership_id, participation_role, rsvp_status
        ) values (
          p_event_id, v_event.household_id, v_mid, 'invitee', 'needs_action'
        )
        on conflict (event_id, membership_id) do nothing;
        perform public._calendar_audit(
          v_event.household_id, 'calendar_event', p_event_id, 'calendar.attendee_added',
          null, jsonb_build_object('membership_id', v_mid), null, v_corr
        );
      end if;
    end loop;

    -- Remove attendees no longer desired (never the organizer).
    for v_mid in
      select a.membership_id
      from public.calendar_event_attendees a
      where a.event_id = p_event_id
        and a.membership_id <> v_event.organizer_membership_id
        and not (a.membership_id = any (v_desired))
    loop
      delete from public.calendar_event_attendees
      where event_id = p_event_id and membership_id = v_mid;
      perform public._calendar_audit(
        v_event.household_id, 'calendar_event', p_event_id, 'calendar.attendee_removed',
        jsonb_build_object('membership_id', v_mid), null, null, v_corr
      );
    end loop;
  end if;

  -- Rewrite reminder configs when a new set is supplied.
  if p_reminder_offsets_minutes is not null then
    if cardinality(p_reminder_offsets_minutes) > 5 then
      raise exception 'At most 5 reminders are allowed';
    end if;
    delete from public.calendar_event_reminders where event_id = p_event_id;
    foreach v_offset in array p_reminder_offsets_minutes loop
      if v_offset is null or v_offset < 0 or v_offset > 10080 then
        raise exception 'Reminder offsets must be between 0 and 10080 minutes';
      end if;
      insert into public.calendar_event_reminders (event_id, household_id, offset_minutes)
      values (p_event_id, v_event.household_id, v_offset)
      on conflict (event_id, offset_minutes) do nothing;
    end loop;
  end if;

  if v_override then
    perform public._calendar_audit(
      v_event.household_id, 'calendar_event', p_event_id, 'calendar.coordinator_override',
      null, jsonb_build_object('action', 'update', 'visibility', v_event.visibility),
      null, v_corr
    );
  end if;

  perform public._calendar_audit(
    v_event.household_id, 'calendar_event', p_event_id, 'calendar.event_updated',
    jsonb_build_object('category', v_event.category, 'visibility', v_event.visibility),
    jsonb_build_object('category', v_category, 'visibility', v_visibility),
    null, v_corr
  );

  -- Notify current attendees (except the actor).
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
      'calendar.event_updated',
      'calendar_event',
      p_event_id,
      v_actor,
      '{}'::jsonb,
      'calendar.event_updated:' || p_event_id::text || ':'
        || floor(extract(epoch from now()))::bigint::text,
      v_recipients,
      'Household calendar event updated',
      'A household calendar event was updated.',
      '/app/' || v_event.household_id::text || '/calendar/events/' || p_event_id::text
    );
  end if;

  return p_event_id;
end;
$$;

revoke all on function public.update_calendar_event(uuid, text, text, text, text, text, boolean, timestamptz, timestamptz, date, date, text, text, date, int, int, text, uuid[], int[], boolean) from public;
revoke all on function public.update_calendar_event(uuid, text, text, text, text, text, boolean, timestamptz, timestamptz, date, date, text, text, date, int, int, text, uuid[], int[], boolean) from anon;
grant execute on function public.update_calendar_event(uuid, text, text, text, text, text, boolean, timestamptz, timestamptz, date, date, text, text, date, int, int, text, uuid[], int[], boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- update_calendar_occurrence (single-instance override; organizer only)
-- ---------------------------------------------------------------------------
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
  p_guest_label text default null
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

  insert into public.calendar_event_exceptions (
    event_id, household_id, original_starts_at, kind, all_day,
    starts_at, ends_at, start_date, end_date_exclusive,
    title, description, location, event_guest_count, guest_label,
    created_by_membership_id
  ) values (
    p_event_id, v_event.household_id, p_original_starts_at, 'override',
    coalesce(p_all_day, false),
    p_starts_at, p_ends_at, p_start_date, p_end_date_exclusive,
    nullif(trim(coalesce(p_title, '')), ''),
    nullif(trim(coalesce(p_description, '')), ''),
    nullif(trim(coalesce(p_location, '')), ''),
    p_event_guest_count,
    nullif(trim(coalesce(p_guest_label, '')), ''),
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
        created_by_membership_id = excluded.created_by_membership_id,
        updated_at = now()
  returning id into v_exception_id;

  -- Update the materialized occurrence if it exists.
  update public.calendar_event_occurrences o
  set starts_at = coalesce(p_starts_at, o.starts_at),
      ends_at = coalesce(p_ends_at, o.ends_at),
      all_day = coalesce(p_all_day, o.all_day),
      start_date = case when p_start_date is not null then p_start_date else o.start_date end,
      end_date_exclusive = case when p_end_date_exclusive is not null
                                then p_end_date_exclusive else o.end_date_exclusive end,
      is_cancelled = false,
      exception_id = v_exception_id,
      updated_at = now()
  where o.event_id = p_event_id
    and o.original_starts_at = p_original_starts_at;

  perform public._calendar_audit(
    v_event.household_id, 'calendar_occurrence', p_event_id, 'calendar.occurrence_updated',
    null,
    jsonb_build_object('original_starts_at', p_original_starts_at, 'exception_id', v_exception_id),
    null, null
  );

  return v_exception_id;
end;
$$;

revoke all on function public.update_calendar_occurrence(uuid, timestamptz, boolean, timestamptz, timestamptz, date, date, text, text, text, int, text) from public;
revoke all on function public.update_calendar_occurrence(uuid, timestamptz, boolean, timestamptz, timestamptz, date, date, text, text, text, int, text) from anon;
grant execute on function public.update_calendar_occurrence(uuid, timestamptz, boolean, timestamptz, timestamptz, date, date, text, text, text, int, text) to authenticated;

-- ---------------------------------------------------------------------------
-- cancel_calendar_occurrence (single-instance cancel; organizer only)
-- ---------------------------------------------------------------------------
create or replace function public.cancel_calendar_occurrence(
  p_event_id uuid,
  p_original_starts_at timestamptz,
  p_reason text default null
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
  v_occurrence_id uuid;
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
    raise exception 'Only the organizer may cancel an occurrence';
  end if;

  insert into public.calendar_event_exceptions (
    event_id, household_id, original_starts_at, kind, created_by_membership_id
  ) values (
    p_event_id, v_event.household_id, p_original_starts_at, 'cancelled', v_actor
  )
  on conflict (event_id, original_starts_at) do update
    set kind = 'cancelled',
        all_day = null,
        starts_at = null,
        ends_at = null,
        start_date = null,
        end_date_exclusive = null,
        created_by_membership_id = excluded.created_by_membership_id,
        updated_at = now()
  returning id into v_exception_id;

  update public.calendar_event_occurrences o
  set is_cancelled = true,
      exception_id = v_exception_id,
      updated_at = now()
  where o.event_id = p_event_id
    and o.original_starts_at = p_original_starts_at
  returning o.id into v_occurrence_id;

  -- Cancel future reminders for this specific occurrence.
  if v_occurrence_id is not null then
    update public.scheduled_notification_requests
    set cancelled_at = now(), updated_at = now()
    where source_type = 'calendar_occurrence'
      and source_id = v_occurrence_id
      and processed_at is null
      and cancelled_at is null;
  end if;

  perform public._calendar_audit(
    v_event.household_id, 'calendar_occurrence', p_event_id, 'calendar.occurrence_cancelled',
    null,
    jsonb_build_object('original_starts_at', p_original_starts_at, 'exception_id', v_exception_id),
    nullif(trim(coalesce(p_reason, '')), ''), null
  );

  return v_exception_id;
end;
$$;

revoke all on function public.cancel_calendar_occurrence(uuid, timestamptz, text) from public;
revoke all on function public.cancel_calendar_occurrence(uuid, timestamptz, text) from anon;
grant execute on function public.cancel_calendar_occurrence(uuid, timestamptz, text) to authenticated;
