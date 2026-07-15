-- Phase 4: calendar occurrence reconciliation, reminder scheduling, personal
-- iCalendar feed RPCs, horizon materialization claim, and test-data cleanup.
-- Occurrence generation (RRULE expansion) happens in TypeScript, which then calls
-- reconcile_calendar_event_occurrences to persist a bounded window.

-- ---------------------------------------------------------------------------
-- _reconcile_calendar_reminders (internal): rebuild schedules for an event
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
  v_rem public.calendar_event_reminders%rowtype;
  v_fire_at timestamptz;
  v_user_id uuid;
  v_recipients uuid[];
  v_organizer_user uuid;
  v_action_href text;
  v_idem text;
  v_count integer := 0;
begin
  select * into v_event from public.calendar_events where id = p_event_id;
  if not found then
    return 0;
  end if;

  perform set_config('householdos.calendar_mutation', 'rpc', true);

  select array_agg(o.id) into v_occ_ids
  from public.calendar_event_occurrences o
  where o.event_id = p_event_id;

  -- Cancel all pending schedules for this event's occurrences, then recreate
  -- schedules for active future occurrences. Idempotency keys make recreation
  -- of unchanged rows a no-op update.
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
    for v_rem in
      select * from public.calendar_event_reminders r where r.event_id = p_event_id
    loop
      v_fire_at := v_occ.starts_at - make_interval(mins => v_rem.offset_minutes);
      -- Skip reminders whose fire time has already passed.
      if v_fire_at < now() - interval '1 minute' then
        continue;
      end if;

      -- Resolve recipients from the reminder's recipient_groups.
      select array_agg(distinct u) into v_recipients
      from (
        select v_organizer_user as u
        where 'organizer' = any (v_rem.recipient_groups)
        union
        select public._calendar_user_id_for_membership(a.membership_id) as u
        from public.calendar_event_attendees a
        where a.event_id = p_event_id
          and (
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
grant execute on function public._reconcile_calendar_reminders(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- reconcile_calendar_event_occurrences: persist a bounded set of occurrences
-- p_occurrences: [{original_starts_at, starts_at, ends_at, all_day,
--                  start_date, end_date_exclusive, is_cancelled}]
-- ---------------------------------------------------------------------------
create or replace function public.reconcile_calendar_event_occurrences(
  p_event_id uuid,
  p_occurrences jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.calendar_events%rowtype;
  v_is_service boolean := coalesce(auth.jwt() ->> 'role', '') = 'service_role';
  v_actor uuid;
  v_new_orig timestamptz[];
  v_elem jsonb;
  v_all_day boolean;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_start_date date;
  v_end_date_excl date;
  v_is_cancelled boolean;
  v_orig timestamptz;
  v_count integer := 0;
  v_materialized timestamptz;
begin
  if p_occurrences is null or jsonb_typeof(p_occurrences) <> 'array' then
    raise exception 'p_occurrences must be a JSON array';
  end if;

  perform set_config('householdos.calendar_mutation', 'rpc', true);
  if v_is_service then
    perform set_config('householdos.privileged_mutation', 'on', true);
  end if;

  select * into v_event from public.calendar_events where id = p_event_id for update;
  if not found then
    raise exception 'Calendar event not found';
  end if;

  -- Authorization: organizer of a scheduled event, or a privileged worker.
  if not v_is_service then
    if v_event.status <> 'scheduled' then
      raise exception 'Only scheduled events can be reconciled';
    end if;
    v_actor := public._calendar_active_membership(v_event.household_id);
    if v_actor <> v_event.organizer_membership_id then
      raise exception 'Only the organizer may reconcile occurrences';
    end if;
  end if;

  -- New set of original_starts_at keys.
  select coalesce(array_agg((e->>'original_starts_at')::timestamptz), '{}')
    into v_new_orig
  from jsonb_array_elements(p_occurrences) as e;

  -- Cancel schedules for occurrences being removed, then delete them.
  update public.scheduled_notification_requests
  set cancelled_at = now(), updated_at = now()
  where source_type = 'calendar_occurrence'
    and source_id in (
      select o.id
      from public.calendar_event_occurrences o
      where o.event_id = p_event_id
        and not (o.original_starts_at = any (v_new_orig))
    )
    and processed_at is null
    and cancelled_at is null;

  delete from public.calendar_event_occurrences o
  where o.event_id = p_event_id
    and not (o.original_starts_at = any (v_new_orig));

  -- Upsert each provided occurrence.
  for v_elem in select value from jsonb_array_elements(p_occurrences) as t(value)
  loop
    v_orig := (v_elem->>'original_starts_at')::timestamptz;
    v_all_day := coalesce((v_elem->>'all_day')::boolean, false);
    v_starts_at := nullif(v_elem->>'starts_at', '')::timestamptz;
    v_ends_at := nullif(v_elem->>'ends_at', '')::timestamptz;
    v_start_date := nullif(v_elem->>'start_date', '')::date;
    v_end_date_excl := nullif(v_elem->>'end_date_exclusive', '')::date;
    v_is_cancelled := coalesce((v_elem->>'is_cancelled')::boolean, false);

    if v_orig is null then
      raise exception 'Each occurrence requires original_starts_at';
    end if;

    -- Fall back to all-day date bounds for concrete timestamps when needed.
    if v_starts_at is null and v_all_day and v_start_date is not null then
      v_starts_at := v_start_date::timestamptz;
    end if;
    if v_ends_at is null and v_all_day and v_end_date_excl is not null then
      v_ends_at := v_end_date_excl::timestamptz;
    end if;
    if v_starts_at is null or v_ends_at is null or v_ends_at <= v_starts_at then
      raise exception 'Occurrence % has invalid start/end bounds', v_orig;
    end if;

    insert into public.calendar_event_occurrences (
      event_id, household_id, original_starts_at, starts_at, ends_at,
      all_day, start_date, end_date_exclusive, is_cancelled
    ) values (
      p_event_id, v_event.household_id, v_orig, v_starts_at, v_ends_at,
      v_all_day, v_start_date, v_end_date_excl, v_is_cancelled
    )
    on conflict (event_id, original_starts_at) do update
      set starts_at = excluded.starts_at,
          ends_at = excluded.ends_at,
          all_day = excluded.all_day,
          start_date = excluded.start_date,
          end_date_exclusive = excluded.end_date_exclusive,
          is_cancelled = excluded.is_cancelled,
          updated_at = now();

    v_count := v_count + 1;
  end loop;

  -- Advance materialized_through to the latest end we know about.
  select max(o.ends_at) into v_materialized
  from public.calendar_event_occurrences o
  where o.event_id = p_event_id;

  update public.calendar_events
  set materialized_through = v_materialized,
      updated_at = now()
  where id = p_event_id;

  perform public._reconcile_calendar_reminders(p_event_id);

  return v_count;
end;
$$;

revoke all on function public.reconcile_calendar_event_occurrences(uuid, jsonb) from public;
revoke all on function public.reconcile_calendar_event_occurrences(uuid, jsonb) from anon;
grant execute on function public.reconcile_calendar_event_occurrences(uuid, jsonb) to authenticated;
grant execute on function public.reconcile_calendar_event_occurrences(uuid, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- create_calendar_feed (personal iCalendar feed token; hash stored only)
-- ---------------------------------------------------------------------------
create or replace function public.create_calendar_feed(
  p_household_id uuid,
  p_token_hash text,
  p_label text default 'Personal calendar feed',
  p_scope text default 'visible_to_me'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_feed_id uuid;
  v_scope text := coalesce(nullif(trim(p_scope), ''), 'visible_to_me');
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_token_hash is null or char_length(trim(p_token_hash)) < 16 then
    raise exception 'A valid token hash is required';
  end if;
  if v_scope not in ('visible_to_me', 'household_public_only') then
    raise exception 'Invalid feed scope';
  end if;

  perform set_config('householdos.calendar_mutation', 'rpc', true);

  if not public.is_active_member(p_household_id) then
    raise exception 'Not an active member of this household';
  end if;

  insert into public.calendar_feed_tokens (
    user_id, household_id, token_hash, label, scope, created_by_user_id
  ) values (
    v_uid, p_household_id, trim(p_token_hash),
    coalesce(nullif(trim(p_label), ''), 'Personal calendar feed'),
    v_scope, v_uid
  )
  returning id into v_feed_id;

  -- Audit without ever recording the token hash.
  perform public._calendar_audit(
    p_household_id, 'calendar_feed', v_feed_id, 'calendar.feed_created',
    null, jsonb_build_object('scope', v_scope), null, null
  );

  return v_feed_id;
end;
$$;

revoke all on function public.create_calendar_feed(uuid, text, text, text) from public;
revoke all on function public.create_calendar_feed(uuid, text, text, text) from anon;
grant execute on function public.create_calendar_feed(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- revoke_calendar_feed (owner only)
-- ---------------------------------------------------------------------------
create or replace function public.revoke_calendar_feed(p_feed_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_feed public.calendar_feed_tokens%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  perform set_config('householdos.calendar_mutation', 'rpc', true);

  select * into v_feed from public.calendar_feed_tokens where id = p_feed_id for update;
  if not found or v_feed.user_id <> v_uid then
    raise exception 'Calendar feed not found';
  end if;

  update public.calendar_feed_tokens
  set revoked_at = coalesce(revoked_at, now())
  where id = p_feed_id;

  perform public._calendar_audit(
    v_feed.household_id, 'calendar_feed', p_feed_id, 'calendar.feed_revoked',
    null, jsonb_build_object('scope', v_feed.scope), null, null
  );

  return p_feed_id;
end;
$$;

revoke all on function public.revoke_calendar_feed(uuid) from public;
revoke all on function public.revoke_calendar_feed(uuid) from anon;
grant execute on function public.revoke_calendar_feed(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- regenerate_calendar_feed (owner only; rotate hash, re-enable)
-- ---------------------------------------------------------------------------
create or replace function public.regenerate_calendar_feed(
  p_feed_id uuid,
  p_new_token_hash text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_feed public.calendar_feed_tokens%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_new_token_hash is null or char_length(trim(p_new_token_hash)) < 16 then
    raise exception 'A valid token hash is required';
  end if;

  perform set_config('householdos.calendar_mutation', 'rpc', true);

  select * into v_feed from public.calendar_feed_tokens where id = p_feed_id for update;
  if not found or v_feed.user_id <> v_uid then
    raise exception 'Calendar feed not found';
  end if;

  update public.calendar_feed_tokens
  set token_hash = trim(p_new_token_hash),
      revoked_at = null,
      last_accessed_at = null
  where id = p_feed_id;

  perform public._calendar_audit(
    v_feed.household_id, 'calendar_feed', p_feed_id, 'calendar.feed_regenerated',
    null, jsonb_build_object('scope', v_feed.scope), null, null
  );

  return p_feed_id;
end;
$$;

revoke all on function public.regenerate_calendar_feed(uuid, text) from public;
revoke all on function public.regenerate_calendar_feed(uuid, text) from anon;
grant execute on function public.regenerate_calendar_feed(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- get_calendar_feed_context: resolve a feed by hash (service_role only)
-- ---------------------------------------------------------------------------
create or replace function public.get_calendar_feed_context(p_token_hash text)
returns table (
  feed_id uuid,
  user_id uuid,
  household_id uuid,
  scope text,
  revoked_at timestamptz,
  expires_at timestamptz,
  membership_active boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_feed public.calendar_feed_tokens%rowtype;
  v_active boolean := false;
begin
  if coalesce(auth.jwt() ->> 'role', '') is distinct from 'service_role' then
    raise exception 'get_calendar_feed_context requires service_role';
  end if;
  if p_token_hash is null or char_length(trim(p_token_hash)) < 16 then
    return;
  end if;

  select * into v_feed
  from public.calendar_feed_tokens
  where token_hash = trim(p_token_hash);
  if not found then
    return;
  end if;

  select exists (
    select 1
    from public.household_memberships m
    where m.household_id = v_feed.household_id
      and m.user_id = v_feed.user_id
      and m.status = 'active'
  ) into v_active;

  -- Touch last_accessed_at only for live feeds.
  if v_feed.revoked_at is null then
    update public.calendar_feed_tokens
    set last_accessed_at = now()
    where id = v_feed.id;
  end if;

  feed_id := v_feed.id;
  user_id := v_feed.user_id;
  household_id := v_feed.household_id;
  scope := v_feed.scope;
  revoked_at := v_feed.revoked_at;
  expires_at := v_feed.expires_at;
  membership_active := v_active;
  return next;
end;
$$;

revoke all on function public.get_calendar_feed_context(text) from public;
revoke all on function public.get_calendar_feed_context(text) from anon;
revoke all on function public.get_calendar_feed_context(text) from authenticated;
grant execute on function public.get_calendar_feed_context(text) to service_role;

-- ---------------------------------------------------------------------------
-- list_authorized_feed_events: events visible to a feed's owner (service_role)
-- ---------------------------------------------------------------------------
create or replace function public.list_authorized_feed_events(
  p_feed_id uuid,
  p_range_start timestamptz,
  p_range_end timestamptz
)
returns table (
  event_id uuid,
  household_id uuid,
  calendar_uid text,
  series_id uuid,
  title text,
  description text,
  location text,
  category text,
  visibility text,
  status text,
  all_day boolean,
  starts_at timestamptz,
  ends_at timestamptz,
  start_date date,
  end_date_exclusive date,
  time_zone text,
  rrule text,
  recurrence_until date,
  recurrence_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_feed public.calendar_feed_tokens%rowtype;
  v_member_id uuid;
  v_active boolean;
begin
  if coalesce(auth.jwt() ->> 'role', '') is distinct from 'service_role' then
    raise exception 'list_authorized_feed_events requires service_role';
  end if;

  select * into v_feed from public.calendar_feed_tokens where id = p_feed_id;
  if not found or v_feed.revoked_at is not null then
    return;
  end if;

  select m.id into v_member_id
  from public.household_memberships m
  where m.household_id = v_feed.household_id
    and m.user_id = v_feed.user_id
    and m.status = 'active'
  limit 1;

  v_active := v_member_id is not null;
  if not v_active then
    return;
  end if;

  return query
  select
    e.id,
    e.household_id,
    e.calendar_uid,
    e.series_id,
    e.title,
    e.description,
    e.location,
    e.category,
    e.visibility,
    e.status,
    e.all_day,
    e.starts_at,
    e.ends_at,
    e.start_date,
    e.end_date_exclusive,
    e.time_zone,
    e.rrule,
    e.recurrence_until,
    e.recurrence_count
  from public.calendar_events e
  where e.household_id = v_feed.household_id
    and (
      -- Range overlap for timed and all-day events (recurring masters always
      -- included so the client can expand within the requested window).
      e.rrule is not null
      or (
        e.all_day = false
        and e.starts_at is not null
        and e.starts_at < p_range_end
        and e.ends_at > p_range_start
      )
      or (
        e.all_day = true
        and e.start_date is not null
        and e.start_date < (p_range_end at time zone e.time_zone)::date
        and e.end_date_exclusive > (p_range_start at time zone e.time_zone)::date
      )
    )
    and (
      case v_feed.scope
        when 'household_public_only' then e.visibility = 'household'
        else (
          e.visibility = 'household'
          or e.organizer_membership_id = v_member_id
          or exists (
            select 1 from public.calendar_event_attendees a
            where a.event_id = e.id and a.membership_id = v_member_id
          )
        )
      end
    );
end;
$$;

revoke all on function public.list_authorized_feed_events(uuid, timestamptz, timestamptz) from public;
revoke all on function public.list_authorized_feed_events(uuid, timestamptz, timestamptz) from anon;
revoke all on function public.list_authorized_feed_events(uuid, timestamptz, timestamptz) from authenticated;
grant execute on function public.list_authorized_feed_events(uuid, timestamptz, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- claim_calendar_horizon_extensions: events needing more materialization
-- ---------------------------------------------------------------------------
create or replace function public.claim_calendar_horizon_extensions(p_limit int default 25)
returns table (event_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 25), 1), 200);
begin
  if coalesce(auth.jwt() ->> 'role', '') is distinct from 'service_role' then
    raise exception 'claim_calendar_horizon_extensions requires service_role';
  end if;

  return query
  select e.id
  from public.calendar_events e
  where e.rrule is not null
    and e.status = 'scheduled'
    and (
      e.materialized_through is null
      or e.materialized_through < now() + interval '60 days'
    )
  order by e.materialized_through asc nulls first, e.created_at asc
  for update of e skip locked
  limit v_limit;
end;
$$;

revoke all on function public.claim_calendar_horizon_extensions(int) from public;
revoke all on function public.claim_calendar_horizon_extensions(int) from anon;
revoke all on function public.claim_calendar_horizon_extensions(int) from authenticated;
grant execute on function public.claim_calendar_horizon_extensions(int) to service_role;

-- ---------------------------------------------------------------------------
-- process_due_scheduled_notifications: enhance calendar.reminder titles/bodies
-- ---------------------------------------------------------------------------
create or replace function public.process_due_scheduled_notifications(
  p_limit int default 50
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_req public.scheduled_notification_requests%rowtype;
  v_event_id uuid;
  v_count integer := 0;
  v_title text;
  v_body text;
begin
  if coalesce(auth.jwt() ->> 'role', '') is distinct from 'service_role' then
    raise exception 'process_due_scheduled_notifications requires service_role';
  end if;

  for v_req in
    select *
    from public.scheduled_notification_requests
    where processed_at is null
      and cancelled_at is null
      and scheduled_at <= now()
    order by scheduled_at asc, created_at asc
    for update skip locked
    limit v_limit
  loop
    v_title := coalesce(
      nullif(v_req.payload ->> 'title', ''),
      case
        when v_req.event_type = 'calendar.reminder' then 'Upcoming household event'
        else 'Scheduled reminder'
      end
    );
    v_body := coalesce(
      nullif(v_req.payload ->> 'body', ''),
      case
        when v_req.event_type = 'calendar.reminder' then 'Open HouseholdOS to review it.'
        else ''
      end
    );

    v_event_id := public._emit_notification_event(
      null,
      v_req.event_type,
      v_req.source_type,
      v_req.source_id,
      null,
      jsonb_build_object(
        'source_type', v_req.source_type,
        'source_id', v_req.source_id
      ),
      'scheduled:' || v_req.idempotency_key,
      array[v_req.recipient_user_id],
      v_title,
      v_body,
      nullif(v_req.payload ->> 'action_href', '')
    );

    update public.scheduled_notification_requests
    set processed_at = now(),
        notification_event_id = v_event_id,
        updated_at = now()
    where id = v_req.id
      and processed_at is null;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.process_due_scheduled_notifications(int) from public;
revoke all on function public.process_due_scheduled_notifications(int) from authenticated;
revoke all on function public.process_due_scheduled_notifications(int) from anon;
grant execute on function public.process_due_scheduled_notifications(int) to service_role;

-- ---------------------------------------------------------------------------
-- cleanup_test_household_data: extend with calendar tables (before payments)
-- ---------------------------------------------------------------------------
create or replace function public.cleanup_test_household_data(p_test_run_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
  v_count integer := 0;
  v_id uuid;
  v_member_ids uuid[];
begin
  if coalesce(auth.jwt() ->> 'role', '') is distinct from 'service_role' then
    raise exception 'cleanup_test_household_data requires service_role';
  end if;
  if p_test_run_id is null
     or char_length(trim(p_test_run_id)) < 8
     or trim(p_test_run_id) !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'cleanup_test_household_data requires a safe test-run identifier';
  end if;

  perform set_config('householdos.privileged_mutation', 'on', true);

  select array_agg(h.id) into v_ids
  from public.households h
  where h.name like '%' || trim(p_test_run_id) || '%';

  if v_ids is null then
    return 0;
  end if;

  foreach v_id in array v_ids loop
    select array_agg(m.user_id) into v_member_ids
    from public.household_memberships m
    where m.household_id = v_id;

    -- Digest items tied to household notifications, then orphan digest batches for members.
    delete from public.notification_digest_items di
      using public.user_notifications un
      where un.id = di.user_notification_id
        and un.household_id = v_id;

    if v_member_ids is not null then
      delete from public.notification_digest_batches b
        where b.user_id = any (v_member_ids)
          and not exists (
            select 1
            from public.notification_digest_items di
            where di.batch_id = b.id
          );

      delete from public.scheduled_notification_requests r
        where r.recipient_user_id = any (v_member_ids);
    end if;

    -- push_subscriptions are user-scoped globally — do not delete on household cleanup.

    delete from public.notification_deliveries d
      using public.notification_events e
      where e.id = d.event_id and e.household_id = v_id;
    delete from public.user_notifications where household_id = v_id;
    delete from public.notification_events where household_id = v_id;

    -- Calendar data (feed tokens, reminders, exceptions, occurrences, attendees, events).
    delete from public.calendar_feed_tokens where household_id = v_id;
    delete from public.calendar_event_reminders where household_id = v_id;
    delete from public.calendar_event_exceptions where household_id = v_id;
    delete from public.calendar_event_occurrences where household_id = v_id;
    delete from public.calendar_event_attendees where household_id = v_id;
    delete from public.calendar_events where household_id = v_id;

    delete from public.dispute_events where household_id = v_id;
    delete from public.reimbursement_disputes where household_id = v_id;
    delete from public.reimbursement_waiver_reversals where household_id = v_id;
    delete from public.reimbursement_waivers where household_id = v_id;
    delete from public.payment_reversals where household_id = v_id;
    delete from public.payment_allocations where household_id = v_id;
    delete from public.payment_private_details where household_id = v_id;
    delete from public.payments where household_id = v_id;
    delete from public.reimbursement_obligations where household_id = v_id;
    delete from public.expense_amendments where household_id = v_id;
    delete from public.expense_adjustment_allocations where household_id = v_id;
    delete from public.expense_item_allocations where household_id = v_id;
    delete from public.expense_adjustments where household_id = v_id;
    delete from public.expense_items where household_id = v_id;
    update public.expenses
      set superseded_by_expense_id = null, supersedes_expense_id = null
      where household_id = v_id;
    delete from public.expenses where household_id = v_id;
    delete from public.audit_events where household_id = v_id;
    delete from public.household_invitations where household_id = v_id;
    delete from public.household_settings where household_id = v_id;
    update public.user_preferences
      set current_household_id = null
      where current_household_id = v_id;
    delete from public.household_membership_roles r
      using public.household_memberships m
      where m.id = r.membership_id and m.household_id = v_id;
    delete from public.household_memberships where household_id = v_id;
    delete from public.households where id = v_id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.cleanup_test_household_data(text) from public;
grant execute on function public.cleanup_test_household_data(text) to service_role;
