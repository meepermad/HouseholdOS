-- UX-C: make notification delivery preferences honest.
--
-- Three problems this fixes:
--   1. notification_channel_preferences only accepted 6 categories, but
--      _notification_meta_for_event_type writes 10. Preferences for house,
--      meals, maintenance, and agreements could never be stored, so those
--      categories were silently un-mutable.
--   2. delivery_mode 'daily_digest' set push deliveries to 'skipped' with
--      failure_category 'digest_pending', and no digest claim/send exists.
--      Choosing digest silently dropped every push forever.
--   3. email deliveries were queued as 'skipped'/'email_not_configured',
--      implying intent that no adapter can honor.

-- =============================================================================
-- 1. Preference categories match the categories the emitter actually writes
-- =============================================================================

alter table public.notification_channel_preferences
  drop constraint if exists notification_channel_preferences_category_check;

alter table public.notification_channel_preferences
  add constraint notification_channel_preferences_category_check
  check (
    category in (
      'payments',
      'disputes',
      'membership',
      'chores',
      'calendar',
      'house',
      'meals',
      'maintenance',
      'agreements',
      'system'
    )
  );

comment on table public.notification_channel_preferences is
  'Per-user category/channel delivery mode. Categories mirror _notification_meta_for_event_type. Missing rows mean product defaults via get_notification_delivery_mode.';

-- =============================================================================
-- 2. Repair rows that silently suppressed delivery
-- =============================================================================

-- Digest was never wired; 'immediate' is the honest reading of "I want these".
update public.notification_channel_preferences
set delivery_mode = 'immediate',
    updated_at = now()
where delivery_mode = 'daily_digest';

-- Email cannot deliver, so a stored email preference means nothing.
delete from public.notification_channel_preferences
where channel = 'email';

-- =============================================================================
-- 3. Resolution never returns a mode the pipeline cannot honor
-- =============================================================================

create or replace function public.get_notification_delivery_mode(
  p_user_id uuid,
  p_category text,
  p_channel text
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_mode text;
  v_category text := lower(trim(coalesce(p_category, 'system')));
  v_channel text := lower(trim(coalesce(p_channel, 'in_app')));
begin
  if v_channel = 'web_push' then
    v_channel := 'push';
  end if;

  -- No email adapter exists. Never report intent the worker cannot fulfil.
  if v_channel = 'email' then
    return 'off';
  end if;

  select delivery_mode into v_mode
  from public.notification_channel_preferences
  where user_id = p_user_id
    and category = v_category
    and channel = v_channel;

  -- Digest batches are never claimed or sent, so digest would mean "dropped".
  if v_mode = 'daily_digest' then
    return 'immediate';
  end if;

  if v_mode is not null then
    return v_mode;
  end if;

  return 'immediate';
end;
$$;

revoke all on function public.get_notification_delivery_mode(uuid, text, text) from public;
grant execute on function public.get_notification_delivery_mode(uuid, text, text) to authenticated;
grant execute on function public.get_notification_delivery_mode(uuid, text, text) to service_role;

comment on function public.get_notification_delivery_mode(uuid, text, text) is
  'Resolves delivery mode for a user/category/channel. Only returns immediate|off: email is always off and daily_digest resolves to immediate until digest send is wired.';

-- =============================================================================
-- 4. Writes are restricted to what the pipeline can actually deliver
-- =============================================================================

create or replace function public.upsert_notification_preference(
  p_category text,
  p_channel text,
  p_delivery_mode text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_category text := lower(trim(coalesce(p_category, '')));
  v_channel text := lower(trim(coalesce(p_channel, '')));
  v_mode text := lower(trim(coalesce(p_delivery_mode, '')));
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if v_channel = 'web_push' then
    v_channel := 'push';
  end if;
  if v_category not in (
    'payments', 'disputes', 'membership', 'chores', 'calendar',
    'house', 'meals', 'maintenance', 'agreements', 'system'
  ) then
    raise exception 'Invalid notification category';
  end if;
  if v_channel not in ('in_app', 'push') then
    raise exception 'Unsupported notification channel';
  end if;
  if v_mode not in ('immediate', 'daily_digest', 'off') then
    raise exception 'Invalid delivery mode';
  end if;

  -- Digest cannot be delivered; store the mode that actually happens.
  if v_mode = 'daily_digest' then
    v_mode := 'immediate';
  end if;

  -- Financial / dispute in-app cannot be fully disabled (Action Center).
  if v_channel = 'in_app'
     and v_category in ('payments', 'disputes')
     and v_mode = 'off' then
    raise exception 'in_app delivery for % cannot be turned off', v_category;
  end if;

  insert into public.notification_channel_preferences (
    user_id, category, channel, delivery_mode, updated_at
  ) values (
    v_uid, v_category, v_channel, v_mode, now()
  )
  on conflict (user_id, category, channel) do update
    set delivery_mode = excluded.delivery_mode,
        updated_at = now();
end;
$$;

revoke all on function public.upsert_notification_preference(text, text, text) from public;
grant execute on function public.upsert_notification_preference(text, text, text) to authenticated;

-- =============================================================================
-- 5. Completing a domain action clears its needs-action notifications
-- =============================================================================

create or replace function public.resolve_action_notifications(
  p_entity_type text,
  p_entity_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_entity_type is null or p_entity_id is null then
    return 0;
  end if;

  with resolved as (
    update public.user_notifications un
    set read_at = now()
    where un.user_id = v_uid
      and un.read_at is null
      and un.action_oriented = true
      and exists (
        select 1
        from public.notification_events ne
        where ne.id = un.event_id
          and ne.entity_type = lower(trim(p_entity_type))
          and ne.entity_id = p_entity_id
      )
    returning un.id
  )
  select count(*)::integer into v_count from resolved;

  return v_count;
end;
$$;

comment on function public.resolve_action_notifications(text, uuid) is
  'Marks the caller''s unread action-oriented notifications for one entity as read. Called after the underlying action is completed so the inbox does not keep asking.';

revoke all on function public.resolve_action_notifications(text, uuid) from public;
revoke all on function public.resolve_action_notifications(text, uuid) from anon;
grant execute on function public.resolve_action_notifications(text, uuid) to authenticated;
