-- Phase 3.1: notification delivery queue, push subscriptions, preferences,
-- quiet hours, digest foundation, scheduled requests, and worker claim RPCs.
-- Extends Phase 3 notification tables; does not rewrite earlier migrations.
-- Privacy: never store raw push endpoints/keys in client-readable paths;
-- last_error must never contain endpoints or subscription keys.

-- =============================================================================
-- 1. Extend user_notifications
-- =============================================================================

alter table public.user_notifications
  add column if not exists category text,
  add column if not exists urgency text not null default 'normal',
  add column if not exists action_oriented boolean not null default false,
  add column if not exists privacy_class text not null default 'routing_only';

alter table public.user_notifications
  drop constraint if exists user_notifications_urgency_check;
alter table public.user_notifications
  add constraint user_notifications_urgency_check
  check (urgency in ('normal', 'high', 'urgent'));

alter table public.user_notifications
  drop constraint if exists user_notifications_privacy_class_check;
alter table public.user_notifications
  add constraint user_notifications_privacy_class_check
  check (privacy_class in ('routing_only', 'member_visible'));

comment on column public.user_notifications.category is
  'Product category for preference routing (payments, disputes, membership, chores, calendar, system).';
comment on column public.user_notifications.urgency is
  'normal | high | urgent — used by quiet-hours override and digests.';
comment on column public.user_notifications.action_oriented is
  'True when the inbox row expects a user action (confirm, resolve, etc.).';
comment on column public.user_notifications.privacy_class is
  'routing_only = titles/bodies safe for shared household context; never put secrets here.';

-- Backfill category/urgency/action from existing events when possible.
update public.user_notifications un
set
  category = case
    when e.event_type like 'dispute.%' then 'disputes'
    when e.event_type like 'payment.%'
      or e.event_type like 'waiver.%'
      or e.event_type like 'refund_obligation.%'
      or e.event_type like 'expense.%' then 'payments'
    when e.event_type like 'membership.%' then 'membership'
    when e.event_type like 'chore.%' then 'chores'
    when e.event_type like 'calendar.%' then 'calendar'
    when e.event_type like 'system.%' then 'system'
    else coalesce(un.category, 'system')
  end,
  urgency = case
    when e.event_type in (
      'payment.awaiting_confirmation',
      'payment.rejected',
      'payment.reversed',
      'waiver.reversed',
      'dispute.opened',
      'refund_obligation.created',
      'expense.voided'
    ) then 'high'
    else coalesce(nullif(un.urgency, ''), 'normal')
  end,
  action_oriented = case
    when e.event_type in (
      'payment.awaiting_confirmation',
      'payment.rejected',
      'waiver.created',
      'waiver.reversed',
      'dispute.opened',
      'refund_obligation.created',
      'expense.voided',
      'expense.amended'
    ) then true
    else coalesce(un.action_oriented, false)
  end
from public.notification_events e
where e.id = un.event_id
  and (un.category is null or un.category = '');

-- =============================================================================
-- 2. Extend notification_deliveries (status + claim columns)
-- =============================================================================

-- Migrate legacy pending → queued before tightening the check constraint.
update public.notification_deliveries
set status = 'queued'
where status = 'pending';

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_status_check;

alter table public.notification_deliveries
  add constraint notification_deliveries_status_check
  check (status in (
    'queued',
    'claimed',
    'sent',
    'retry',
    'dead_letter',
    'cancelled',
    'expired',
    'failed',
    'skipped'
  ));

alter table public.notification_deliveries
  alter column status set default 'queued';

alter table public.notification_deliveries
  add column if not exists user_notification_id uuid
    references public.user_notifications (id) on delete set null,
  add column if not exists subscription_id uuid,
  add column if not exists available_at timestamptz not null default now(),
  add column if not exists claimed_at timestamptz,
  add column if not exists claim_expires_at timestamptz,
  add column if not exists claim_token uuid,
  add column if not exists failure_code text,
  add column if not exists failure_category text,
  add column if not exists provider_message_id text,
  add column if not exists idempotency_key text;

-- Existing rows: release for claim based on original create time.
update public.notification_deliveries
set available_at = created_at
where available_at is distinct from created_at
  and claimed_at is null
  and sent_at is null;

-- Link deliveries to in-app user_notifications where possible.
update public.notification_deliveries d
set user_notification_id = un.id
from public.user_notifications un
where un.event_id = d.event_id
  and un.user_id = d.user_id
  and d.user_notification_id is null;

comment on column public.notification_deliveries.last_error is
  'Sanitized worker error only. Must never store raw push endpoints, p256dh, auth keys, or secrets.';
comment on column public.notification_deliveries.idempotency_key is
  'Optional durable key for external-channel rows; partial unique when present.';
comment on column public.notification_deliveries.failure_category is
  'Machine category e.g. digest_pending, email_not_configured, subscription_gone, transient.';
comment on table public.notification_deliveries is
  'Per-channel delivery attempts. Clients may SELECT own status rows; claim/update is worker-only.';

create unique index if not exists notification_deliveries_idempotency_key_uidx
  on public.notification_deliveries (idempotency_key)
  where idempotency_key is not null;

create index if not exists notification_deliveries_claim_ready_idx
  on public.notification_deliveries (available_at, next_attempt_at, created_at)
  where status in ('queued', 'retry');

create index if not exists notification_deliveries_expired_claim_idx
  on public.notification_deliveries (claim_expires_at)
  where status = 'claimed';

create index if not exists notification_deliveries_user_notification_idx
  on public.notification_deliveries (user_notification_id)
  where user_notification_id is not null;

-- =============================================================================
-- 3. push_subscriptions (+ safe client view + RPCs)
-- =============================================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  endpoint_hash text not null,
  p256dh text not null,
  auth text not null,
  user_agent_summary text,
  device_label text,
  platform_category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_success_at timestamptz,
  last_failure_at timestamptz,
  failure_count integer not null default 0 check (failure_count >= 0),
  active boolean not null default true,
  disabled_reason text,
  expiration_time timestamptz,
  installation_id text,
  constraint push_subscriptions_endpoint_hash_unique unique (endpoint_hash),
  constraint push_subscriptions_user_endpoint_hash_unique unique (user_id, endpoint_hash)
);

comment on table public.push_subscriptions is
  'Web Push subscription secrets. Clients must NEVER SELECT this table; use push_subscription_devices + upsert/deactivate RPCs.';

create index if not exists push_subscriptions_user_active_idx
  on public.push_subscriptions (user_id)
  where active = true;

drop trigger if exists push_subscriptions_set_updated_at on public.push_subscriptions;
create trigger push_subscriptions_set_updated_at
  before update on public.push_subscriptions
  for each row execute function public.set_updated_at();

-- FK from deliveries after table exists.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'notification_deliveries_subscription_id_fkey'
  ) then
    alter table public.notification_deliveries
      add constraint notification_deliveries_subscription_id_fkey
      foreign key (subscription_id)
      references public.push_subscriptions (id)
      on delete set null;
  end if;
end;
$$;

alter table public.push_subscriptions enable row level security;

-- Own-row RLS for the limited column grants below (defense in depth).
drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own
  on public.push_subscriptions for select
  to authenticated
  using (user_id = auth.uid());

-- Clients never get full-table SELECT (endpoint / p256dh / auth stay ungranted).
revoke all on table public.push_subscriptions from public;
revoke all on table public.push_subscriptions from anon;
revoke all on table public.push_subscriptions from authenticated;
grant all on table public.push_subscriptions to service_role;
grant select (
  id,
  user_id,
  device_label,
  platform_category,
  user_agent_summary,
  active,
  created_at,
  updated_at,
  last_success_at,
  last_failure_at,
  failure_count,
  disabled_reason,
  installation_id,
  expiration_time
) on table public.push_subscriptions to authenticated;

-- Safe device list (no endpoint / keys). security_invoker evaluates RLS as caller.
create or replace view public.push_subscription_devices
with (security_invoker = true)
as
select
  id,
  user_id,
  device_label,
  platform_category,
  user_agent_summary,
  active,
  created_at,
  updated_at,
  last_success_at,
  failure_count,
  disabled_reason,
  installation_id
from public.push_subscriptions;

comment on view public.push_subscription_devices is
  'Client-safe projection of push devices. Excludes endpoint, p256dh, and auth.';

grant select on public.push_subscription_devices to authenticated;

create or replace function public.upsert_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent_summary text default null,
  p_device_label text default null,
  p_platform_category text default null,
  p_installation_id text default null,
  p_expiration_time timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_hash text;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_endpoint is null or char_length(trim(p_endpoint)) < 8 then
    raise exception 'Invalid push endpoint';
  end if;
  if p_p256dh is null or char_length(trim(p_p256dh)) < 8 then
    raise exception 'Invalid push p256dh';
  end if;
  if p_auth is null or char_length(trim(p_auth)) < 8 then
    raise exception 'Invalid push auth';
  end if;

  v_hash := encode(digest(trim(p_endpoint), 'sha256'), 'hex');

  insert into public.push_subscriptions (
    user_id,
    endpoint,
    endpoint_hash,
    p256dh,
    auth,
    user_agent_summary,
    device_label,
    platform_category,
    installation_id,
    expiration_time,
    active,
    disabled_reason,
    failure_count,
    updated_at
  ) values (
    v_uid,
    trim(p_endpoint),
    v_hash,
    trim(p_p256dh),
    trim(p_auth),
    nullif(trim(coalesce(p_user_agent_summary, '')), ''),
    nullif(trim(coalesce(p_device_label, '')), ''),
    nullif(trim(coalesce(p_platform_category, '')), ''),
    nullif(trim(coalesce(p_installation_id, '')), ''),
    p_expiration_time,
    true,
    null,
    0,
    now()
  )
  on conflict (endpoint_hash) do update
    set
      user_id = excluded.user_id,
      endpoint = excluded.endpoint,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      user_agent_summary = coalesce(excluded.user_agent_summary, public.push_subscriptions.user_agent_summary),
      device_label = coalesce(excluded.device_label, public.push_subscriptions.device_label),
      platform_category = coalesce(excluded.platform_category, public.push_subscriptions.platform_category),
      installation_id = coalesce(excluded.installation_id, public.push_subscriptions.installation_id),
      expiration_time = excluded.expiration_time,
      active = true,
      disabled_reason = null,
      failure_count = 0,
      updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.upsert_push_subscription(text, text, text, text, text, text, text, timestamptz) from public;
grant execute on function public.upsert_push_subscription(text, text, text, text, text, text, text, timestamptz) to authenticated;

create or replace function public.deactivate_push_subscription(
  p_subscription_id uuid default null,
  p_endpoint_hash text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_updated integer := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_subscription_id is null and (p_endpoint_hash is null or char_length(trim(p_endpoint_hash)) < 8) then
    raise exception 'Provide p_subscription_id or p_endpoint_hash';
  end if;

  update public.push_subscriptions
  set
    active = false,
    disabled_reason = coalesce(disabled_reason, 'user_deactivated'),
    updated_at = now()
  where user_id = v_uid
    and (
      (p_subscription_id is not null and id = p_subscription_id)
      or (p_endpoint_hash is not null and endpoint_hash = lower(trim(p_endpoint_hash)))
    );

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.deactivate_push_subscription(uuid, text) from public;
grant execute on function public.deactivate_push_subscription(uuid, text) to authenticated;

-- =============================================================================
-- 4. notification_channel_preferences
-- =============================================================================

create table if not exists public.notification_channel_preferences (
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null,
  channel text not null check (channel in ('in_app', 'push', 'email')),
  delivery_mode text not null check (delivery_mode in ('immediate', 'daily_digest', 'off')),
  updated_at timestamptz not null default now(),
  primary key (user_id, category, channel),
  constraint notification_channel_preferences_category_check
    check (category in ('payments', 'disputes', 'membership', 'chores', 'calendar', 'system'))
);

comment on table public.notification_channel_preferences is
  'Per-user category/channel delivery mode. Missing rows mean product defaults via get_notification_delivery_mode.';

drop trigger if exists notification_channel_preferences_set_updated_at
  on public.notification_channel_preferences;
create trigger notification_channel_preferences_set_updated_at
  before update on public.notification_channel_preferences
  for each row execute function public.set_updated_at();

alter table public.notification_channel_preferences enable row level security;

create policy notification_channel_preferences_select_own
  on public.notification_channel_preferences for select
  to authenticated
  using (user_id = auth.uid());

create policy notification_channel_preferences_insert_own
  on public.notification_channel_preferences for insert
  to authenticated
  with check (user_id = auth.uid());

create policy notification_channel_preferences_update_own
  on public.notification_channel_preferences for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on table public.notification_channel_preferences from public;
revoke all on table public.notification_channel_preferences from anon;
grant select, insert, update on table public.notification_channel_preferences to authenticated;

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

  select delivery_mode into v_mode
  from public.notification_channel_preferences
  where user_id = p_user_id
    and category = v_category
    and channel = v_channel;

  if v_mode is not null then
    return v_mode;
  end if;

  -- Product defaults (no row).
  if v_channel = 'email' then
    return 'off';
  end if;

  -- in_app and push: immediate for known categories.
  if v_category in ('payments', 'disputes', 'membership', 'chores', 'calendar', 'system') then
    return 'immediate';
  end if;

  return 'immediate';
end;
$$;

revoke all on function public.get_notification_delivery_mode(uuid, text, text) from public;
grant execute on function public.get_notification_delivery_mode(uuid, text, text) to authenticated;
grant execute on function public.get_notification_delivery_mode(uuid, text, text) to service_role;

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
  if v_category not in ('payments', 'disputes', 'membership', 'chores', 'calendar', 'system') then
    raise exception 'Invalid notification category';
  end if;
  if v_channel not in ('in_app', 'push', 'email') then
    raise exception 'Invalid notification channel';
  end if;
  if v_mode not in ('immediate', 'daily_digest', 'off') then
    raise exception 'Invalid delivery mode';
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
-- 5. notification_quiet_hours + helper
-- =============================================================================

create table if not exists public.notification_quiet_hours (
  user_id uuid primary key references auth.users (id) on delete cascade,
  enabled boolean not null default false,
  start_local time not null default time '22:00',
  end_local time not null default time '07:00',
  time_zone text not null default 'America/Chicago',
  allow_urgent_override boolean not null default true,
  preview_mode text not null default 'generic',
  updated_at timestamptz not null default now()
);

alter table public.notification_quiet_hours
  add column if not exists preview_mode text;

update public.notification_quiet_hours
set preview_mode = coalesce(preview_mode, 'generic')
where preview_mode is null;

alter table public.notification_quiet_hours
  alter column preview_mode set default 'generic';

alter table public.notification_quiet_hours
  alter column preview_mode set not null;

alter table public.notification_quiet_hours
  drop constraint if exists notification_quiet_hours_preview_mode_check;
alter table public.notification_quiet_hours
  add constraint notification_quiet_hours_preview_mode_check
  check (preview_mode in ('generic', 'detailed'));

comment on table public.notification_quiet_hours is
  'Per-user quiet hours and lock-screen privacy preview (generic|detailed).';
comment on column public.notification_quiet_hours.preview_mode is
  'Lock-screen push preview: generic (default) or detailed (still excludes amounts/refs).';

drop trigger if exists notification_quiet_hours_set_updated_at on public.notification_quiet_hours;
create trigger notification_quiet_hours_set_updated_at
  before update on public.notification_quiet_hours
  for each row execute function public.set_updated_at();

alter table public.notification_quiet_hours enable row level security;

create policy notification_quiet_hours_select_own
  on public.notification_quiet_hours for select
  to authenticated
  using (user_id = auth.uid());

create policy notification_quiet_hours_insert_own
  on public.notification_quiet_hours for insert
  to authenticated
  with check (user_id = auth.uid());

create policy notification_quiet_hours_update_own
  on public.notification_quiet_hours for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on table public.notification_quiet_hours from public;
revoke all on table public.notification_quiet_hours from anon;
grant select, insert, update on table public.notification_quiet_hours to authenticated;

create or replace function public._quiet_hours_available_at(
  p_user_id uuid,
  p_urgency text,
  p_now timestamptz default now()
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_enabled boolean;
  v_start time;
  v_end time;
  v_tz text;
  v_allow_urgent boolean;
  v_local_ts timestamp;
  v_local_time time;
  v_in_quiet boolean := false;
  v_end_local timestamp;
  v_urgency text := lower(trim(coalesce(p_urgency, 'normal')));
begin
  select
    q.enabled,
    q.start_local,
    q.end_local,
    q.time_zone,
    q.allow_urgent_override
  into
    v_enabled,
    v_start,
    v_end,
    v_tz,
    v_allow_urgent
  from public.notification_quiet_hours q
  where q.user_id = p_user_id;

  -- No row or disabled → available immediately.
  if v_enabled is distinct from true then
    return p_now;
  end if;

  if v_urgency = 'urgent' and coalesce(v_allow_urgent, true) then
    return p_now;
  end if;

  begin
    v_local_ts := (p_now at time zone v_tz);
  exception
    when others then
      -- Bad timezone: fail open (do not delay).
      return p_now;
  end;

  v_local_time := v_local_ts::time;

  if v_start = v_end then
    -- Degenerate window: treat as always quiet; release at next end (tomorrow).
    v_in_quiet := true;
  elsif v_start < v_end then
    -- Same-calendar-day window (e.g. 13:00–17:00).
    v_in_quiet := (v_local_time >= v_start and v_local_time < v_end);
  else
    -- Overnight window (e.g. 22:00–07:00).
    v_in_quiet := (v_local_time >= v_start or v_local_time < v_end);
  end if;

  if not v_in_quiet then
    return p_now;
  end if;

  if v_start < v_end then
    v_end_local := date_trunc('day', v_local_ts) + v_end;
  else
    -- Overnight: if currently after start, end is tomorrow; if before end, end is today.
    if v_local_time >= v_start then
      v_end_local := date_trunc('day', v_local_ts) + interval '1 day' + v_end;
    else
      v_end_local := date_trunc('day', v_local_ts) + v_end;
    end if;
  end if;

  return (v_end_local at time zone v_tz);
end;
$$;

revoke all on function public._quiet_hours_available_at(uuid, text, timestamptz) from public;
-- Internal helper; grant to roles that run emit / workers.
grant execute on function public._quiet_hours_available_at(uuid, text, timestamptz) to service_role;

-- =============================================================================
-- 6. Digest batches / items
-- =============================================================================

create table if not exists public.notification_digest_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'claimed', 'sent', 'cancelled')),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  claim_token uuid,
  claim_expires_at timestamptz,
  constraint notification_digest_batches_idempotency_key_unique unique (idempotency_key),
  constraint notification_digest_batches_period_check check (period_end > period_start)
);

comment on table public.notification_digest_batches is
  'Daily digest envelopes. Clients may select own batches; workers claim/send via service_role.';

create index if not exists notification_digest_batches_user_idx
  on public.notification_digest_batches (user_id, created_at desc);

create table if not exists public.notification_digest_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.notification_digest_batches (id) on delete cascade,
  user_notification_id uuid not null references public.user_notifications (id) on delete cascade,
  delivery_id uuid references public.notification_deliveries (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint notification_digest_items_batch_notification_unique
    unique (batch_id, user_notification_id)
);

comment on table public.notification_digest_items is
  'Items attached to a digest batch. No provider error blobs here.';

create index if not exists notification_digest_items_notification_idx
  on public.notification_digest_items (user_notification_id);

alter table public.notification_digest_batches enable row level security;
alter table public.notification_digest_items enable row level security;

create policy notification_digest_batches_select_own
  on public.notification_digest_batches for select
  to authenticated
  using (user_id = auth.uid());

create policy notification_digest_items_select_own
  on public.notification_digest_items for select
  to authenticated
  using (
    exists (
      select 1
      from public.notification_digest_batches b
      where b.id = batch_id
        and b.user_id = auth.uid()
    )
  );

revoke all on table public.notification_digest_batches from public;
revoke all on table public.notification_digest_batches from anon;
revoke all on table public.notification_digest_items from public;
revoke all on table public.notification_digest_items from anon;
grant select on table public.notification_digest_batches to authenticated;
grant select on table public.notification_digest_items to authenticated;
grant all on table public.notification_digest_batches to service_role;
grant all on table public.notification_digest_items to service_role;

-- =============================================================================
-- 7. scheduled_notification_requests (foundation; no client access)
-- =============================================================================

create table if not exists public.scheduled_notification_requests (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_id uuid not null,
  recipient_user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null,
  scheduled_at timestamptz not null,
  time_zone text not null default 'America/Chicago',
  idempotency_key text not null,
  cancelled_at timestamptz,
  processed_at timestamptz,
  notification_event_id uuid references public.notification_events (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scheduled_notification_requests_idempotency_key_unique unique (idempotency_key)
);

comment on table public.scheduled_notification_requests is
  'Future chores/calendar schedule outbox. No client RLS access; domain RPCs / workers only.';

create index if not exists scheduled_notification_requests_due_idx
  on public.scheduled_notification_requests (scheduled_at)
  where processed_at is null and cancelled_at is null;

drop trigger if exists scheduled_notification_requests_set_updated_at
  on public.scheduled_notification_requests;
create trigger scheduled_notification_requests_set_updated_at
  before update on public.scheduled_notification_requests
  for each row execute function public.set_updated_at();

alter table public.scheduled_notification_requests enable row level security;
-- Intentionally no policies for authenticated/anon.

revoke all on table public.scheduled_notification_requests from public;
revoke all on table public.scheduled_notification_requests from anon;
revoke all on table public.scheduled_notification_requests from authenticated;
grant all on table public.scheduled_notification_requests to service_role;

-- Foundation helpers for future domain RPCs (not granted to authenticated).
create or replace function public._create_scheduled_notification_request(
  p_source_type text,
  p_source_id uuid,
  p_recipient_user_id uuid,
  p_event_type text,
  p_scheduled_at timestamptz,
  p_time_zone text,
  p_idempotency_key text,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_safe jsonb := jsonb_build_object(
    'source_type', p_source_type,
    'source_id', p_source_id
  );
begin
  -- Keep payload minimal even for schedules; future domains may enrich via join.
  insert into public.scheduled_notification_requests (
    source_type,
    source_id,
    recipient_user_id,
    event_type,
    scheduled_at,
    time_zone,
    idempotency_key,
    payload
  ) values (
    p_source_type,
    p_source_id,
    p_recipient_user_id,
    p_event_type,
    p_scheduled_at,
    coalesce(nullif(trim(p_time_zone), ''), 'America/Chicago'),
    p_idempotency_key,
    coalesce(p_payload, v_safe)
  )
  on conflict (idempotency_key) do update
    set idempotency_key = excluded.idempotency_key
  returning id into v_id;

  if v_id is null then
    select id into v_id
    from public.scheduled_notification_requests
    where idempotency_key = p_idempotency_key;
  end if;

  return v_id;
end;
$$;

create or replace function public._cancel_scheduled_notification_request(
  p_idempotency_key text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer := 0;
begin
  update public.scheduled_notification_requests
  set cancelled_at = coalesce(cancelled_at, now()),
      updated_at = now()
  where idempotency_key = p_idempotency_key
    and processed_at is null
    and cancelled_at is null;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public._create_scheduled_notification_request(text, uuid, uuid, text, timestamptz, text, text, jsonb) from public;
revoke all on function public._cancel_scheduled_notification_request(text) from public;
-- Future domain RPCs (security definer) will call these transactionally.
-- Do not GRANT to authenticated/anon.

-- =============================================================================
-- Metadata helpers for emit
-- =============================================================================

create or replace function public._notification_meta_for_event_type(p_event_type text)
returns table (
  category text,
  urgency text,
  action_oriented boolean
)
language sql
immutable
as $$
  select
    case
      when p_event_type like 'dispute.%' then 'disputes'
      when p_event_type like 'payment.%'
        or p_event_type like 'waiver.%'
        or p_event_type like 'refund_obligation.%'
        or p_event_type like 'expense.%' then 'payments'
      when p_event_type like 'membership.%' then 'membership'
      when p_event_type like 'chore.%' then 'chores'
      when p_event_type like 'calendar.%' then 'calendar'
      when p_event_type like 'system.%' then 'system'
      else 'system'
    end,
    case
      when p_event_type in (
        'payment.awaiting_confirmation',
        'payment.rejected',
        'payment.reversed',
        'waiver.reversed',
        'dispute.opened',
        'refund_obligation.created',
        'expense.voided'
      ) then 'high'
      when p_event_type like 'system.%urgent%' then 'urgent'
      else 'normal'
    end,
    case
      when p_event_type in (
        'payment.awaiting_confirmation',
        'payment.rejected',
        'waiver.created',
        'waiver.reversed',
        'dispute.opened',
        'refund_obligation.created',
        'expense.voided',
        'expense.amended'
      ) then true
      else false
    end;
$$;

revoke all on function public._notification_meta_for_event_type(text) from public;

create or replace function public._sanitize_delivery_error(p_error text)
returns text
language sql
immutable
as $$
  select left(
    regexp_replace(
      coalesce(p_error, ''),
      '(https?://[^\\s]+|endpoint[=:][^\\s]+|p256dh[=:][^\\s]+|auth[=:][^\\s]+|Bearer\\s+\\S+)',
      '[redacted]',
      'gi'
    ),
    500
  );
$$;

revoke all on function public._sanitize_delivery_error(text) from public;

-- =============================================================================
-- 8. Rewrite _emit_notification_event
-- =============================================================================

create or replace function public._emit_notification_event(
  p_household_id uuid,
  p_event_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_actor_membership_id uuid,
  p_payload jsonb,
  p_idempotency_key text,
  p_recipient_user_ids uuid[],
  p_title text,
  p_body text,
  p_action_href text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_uid uuid;
  v_safe jsonb;
  v_category text;
  v_urgency text;
  v_action boolean;
  v_un_id uuid;
  v_push_mode text;
  v_email_mode text;
  v_push_status text;
  v_push_available timestamptz;
  v_push_failure_category text;
  v_email_status text;
  v_idem_push text;
  v_idem_email text;
begin
  -- Discard caller payload richness; keep routing keys only.
  v_safe := jsonb_build_object(
    'source_type', p_entity_type,
    'source_id', p_entity_id
  );

  if coalesce(p_title, '') ~* '(password|token|secret|external_reference)'
     or coalesce(p_body, '') ~* '(password|token|secret|external_reference)'
     or coalesce(p_action_href, '') ~* '(password|token|secret)' then
    raise exception 'Notification content contains forbidden fields';
  end if;

  select m.category, m.urgency, m.action_oriented
  into v_category, v_urgency, v_action
  from public._notification_meta_for_event_type(p_event_type) m;

  insert into public.notification_events (
    household_id,
    event_type,
    entity_type,
    entity_id,
    actor_membership_id,
    payload,
    idempotency_key
  ) values (
    p_household_id,
    p_event_type,
    p_entity_type,
    p_entity_id,
    p_actor_membership_id,
    v_safe,
    p_idempotency_key
  )
  on conflict (idempotency_key) do update
    set idempotency_key = excluded.idempotency_key
  returning id into v_event_id;

  if v_event_id is null then
    select id into v_event_id
    from public.notification_events
    where idempotency_key = p_idempotency_key;
  end if;

  if p_recipient_user_ids is not null then
    foreach v_uid in array p_recipient_user_ids loop
      if v_uid is null then
        continue;
      end if;
      begin
        insert into public.user_notifications (
          user_id,
          event_id,
          household_id,
          title,
          body,
          action_href,
          category,
          urgency,
          action_oriented,
          privacy_class
        ) values (
          v_uid,
          v_event_id,
          p_household_id,
          p_title,
          coalesce(p_body, ''),
          p_action_href,
          v_category,
          v_urgency,
          v_action,
          'routing_only'
        )
        on conflict (event_id, user_id) do nothing
        returning id into v_un_id;

        if v_un_id is null then
          select id into v_un_id
          from public.user_notifications
          where event_id = v_event_id
            and user_id = v_uid;
        end if;

        -- in_app always created as sent (Action Center); preferences cannot block financial in_app.
        insert into public.notification_deliveries (
          event_id,
          user_id,
          user_notification_id,
          channel,
          status,
          available_at,
          sent_at,
          idempotency_key
        ) values (
          v_event_id,
          v_uid,
          v_un_id,
          'in_app',
          'sent',
          now(),
          now(),
          v_event_id::text || ':' || v_uid::text || ':in_app'
        )
        on conflict (event_id, user_id, channel) do update
          set user_notification_id = coalesce(
                public.notification_deliveries.user_notification_id,
                excluded.user_notification_id
              );

        -- web_push: preference-driven queue; never send from SQL.
        v_push_mode := public.get_notification_delivery_mode(v_uid, v_category, 'push');
        v_push_failure_category := null;
        v_push_available := now();

        if v_push_mode = 'off' then
          v_push_status := 'cancelled';
          v_push_failure_category := 'preference_off';
        elsif v_push_mode = 'daily_digest' then
          v_push_status := 'skipped';
          v_push_failure_category := 'digest_pending';
        else
          v_push_status := 'queued';
          v_push_available := public._quiet_hours_available_at(v_uid, v_urgency, now());
        end if;

        v_idem_push := v_event_id::text || ':' || v_uid::text || ':web_push';

        insert into public.notification_deliveries (
          event_id,
          user_id,
          user_notification_id,
          channel,
          status,
          available_at,
          failure_category,
          idempotency_key
        ) values (
          v_event_id,
          v_uid,
          v_un_id,
          'web_push',
          v_push_status,
          v_push_available,
          v_push_failure_category,
          v_idem_push
        )
        on conflict (event_id, user_id, channel) do nothing;

        -- email: document intent when immediate; no provider in Phase 3.1.
        v_email_mode := public.get_notification_delivery_mode(v_uid, v_category, 'email');
        if v_email_mode = 'immediate' then
          v_email_status := 'skipped';
          v_idem_email := v_event_id::text || ':' || v_uid::text || ':email';
          insert into public.notification_deliveries (
            event_id,
            user_id,
            user_notification_id,
            channel,
            status,
            available_at,
            failure_category,
            failure_code,
            idempotency_key
          ) values (
            v_event_id,
            v_uid,
            v_un_id,
            'email',
            v_email_status,
            now(),
            'email_not_configured',
            'email_not_configured',
            v_idem_email
          )
          on conflict (event_id, user_id, channel) do nothing;
        end if;
      exception
        when others then
          raise warning 'notification fan-out failed for user %: %', v_uid, sqlerrm;
      end;
    end loop;
  end if;

  return v_event_id;
exception
  when others then
    if v_event_id is null then
      raise;
    end if;
    raise warning 'notification emit recovered after fan-out error: %', sqlerrm;
    return v_event_id;
end;
$$;

revoke all on function public._emit_notification_event(uuid, text, text, uuid, uuid, jsonb, text, uuid[], text, text, text) from public;

-- =============================================================================
-- 9. Worker claim / complete / fail + process due schedules
-- =============================================================================

create or replace function public.claim_notification_deliveries(
  p_batch_size int default 50,
  p_worker_id uuid default gen_random_uuid(),
  p_claim_ttl_seconds int default 120
)
returns setof public.notification_deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := least(greatest(coalesce(p_batch_size, 50), 1), 100);
  v_ttl int := least(greatest(coalesce(p_claim_ttl_seconds, 120), 15), 900);
  v_token uuid := coalesce(p_worker_id, gen_random_uuid());
begin
  if coalesce(auth.jwt() ->> 'role', '') is distinct from 'service_role' then
    raise exception 'claim_notification_deliveries requires service_role';
  end if;

  return query
  with picked as (
    select d.id
    from public.notification_deliveries d
    where (
        d.status in ('queued', 'retry')
        and d.available_at <= now()
        and (d.next_attempt_at is null or d.next_attempt_at <= now())
      )
      or (
        d.status = 'claimed'
        and d.claim_expires_at is not null
        and d.claim_expires_at < now()
      )
    order by d.available_at asc nulls first, d.created_at asc
    for update of d skip locked
    limit v_limit
  ),
  updated as (
    update public.notification_deliveries d
    set
      status = 'claimed',
      claimed_at = now(),
      claim_expires_at = now() + make_interval(secs => v_ttl),
      claim_token = v_token,
      updated_at = now()
    from picked p
    where d.id = p.id
    returning d.*
  )
  select * from updated;
end;
$$;

revoke all on function public.claim_notification_deliveries(int, uuid, int) from public;
revoke all on function public.claim_notification_deliveries(int, uuid, int) from authenticated;
revoke all on function public.claim_notification_deliveries(int, uuid, int) from anon;
grant execute on function public.claim_notification_deliveries(int, uuid, int) to service_role;

create or replace function public.complete_notification_delivery(
  p_delivery_id uuid,
  p_claim_token uuid,
  p_provider_message_id text default null,
  p_subscription_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer := 0;
begin
  if coalesce(auth.jwt() ->> 'role', '') is distinct from 'service_role' then
    raise exception 'complete_notification_delivery requires service_role';
  end if;

  update public.notification_deliveries
  set
    status = 'sent',
    sent_at = now(),
    provider_message_id = coalesce(p_provider_message_id, provider_message_id),
    subscription_id = coalesce(p_subscription_id, subscription_id),
    last_error = null,
    failure_code = null,
    failure_category = null,
    claim_expires_at = null,
    updated_at = now()
  where id = p_delivery_id
    and status = 'claimed'
    and claim_token is not distinct from p_claim_token;

  get diagnostics v_updated = row_count;

  if v_updated > 0 and p_subscription_id is not null then
    update public.push_subscriptions
    set last_success_at = now(),
        failure_count = 0,
        updated_at = now()
    where id = p_subscription_id;
  end if;

  return v_updated > 0;
end;
$$;

revoke all on function public.complete_notification_delivery(uuid, uuid, text, uuid) from public;
revoke all on function public.complete_notification_delivery(uuid, uuid, text, uuid) from authenticated;
grant execute on function public.complete_notification_delivery(uuid, uuid, text, uuid) to service_role;

create or replace function public.fail_notification_delivery(
  p_delivery_id uuid,
  p_claim_token uuid,
  p_failure_code text,
  p_failure_category text default null,
  p_last_error text default null,
  p_retry boolean default true,
  p_retry_delay_seconds int default 60,
  p_subscription_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.notification_deliveries%rowtype;
  v_delay int := least(greatest(coalesce(p_retry_delay_seconds, 60), 5), 86400);
  v_next_status text;
  v_updated integer := 0;
begin
  if coalesce(auth.jwt() ->> 'role', '') is distinct from 'service_role' then
    raise exception 'fail_notification_delivery requires service_role';
  end if;

  select * into v_row
  from public.notification_deliveries
  where id = p_delivery_id
    and status = 'claimed'
    and claim_token is not distinct from p_claim_token
  for update;

  if not found then
    return false;
  end if;

  if coalesce(p_retry, true) and (v_row.attempt_count + 1) < 8 then
    v_next_status := 'retry';
  else
    v_next_status := 'dead_letter';
  end if;

  update public.notification_deliveries
  set
    status = v_next_status,
    attempt_count = attempt_count + 1,
    failure_code = left(coalesce(p_failure_code, 'unknown'), 120),
    failure_category = left(coalesce(p_failure_category, 'transient'), 120),
    last_error = public._sanitize_delivery_error(p_last_error),
    next_attempt_at = case
      when v_next_status = 'retry' then now() + make_interval(secs => v_delay)
      else null
    end,
    available_at = case
      when v_next_status = 'retry' then now() + make_interval(secs => v_delay)
      else available_at
    end,
    claim_expires_at = null,
    subscription_id = coalesce(p_subscription_id, subscription_id),
    updated_at = now()
  where id = p_delivery_id;

  get diagnostics v_updated = row_count;

  if p_subscription_id is not null then
    update public.push_subscriptions
    set last_failure_at = now(),
        failure_count = failure_count + 1,
        updated_at = now()
    where id = p_subscription_id;
  end if;

  return v_updated > 0;
end;
$$;

revoke all on function public.fail_notification_delivery(uuid, uuid, text, text, text, boolean, int, uuid) from public;
revoke all on function public.fail_notification_delivery(uuid, uuid, text, text, text, boolean, int, uuid) from authenticated;
grant execute on function public.fail_notification_delivery(uuid, uuid, text, text, text, boolean, int, uuid) to service_role;

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
      'Scheduled reminder'
    );
    v_body := coalesce(nullif(v_req.payload ->> 'body', ''), '');

    -- Titles from schedule payload still pass emit sanitizer.
    v_event_id := public._emit_notification_event(
      null, -- household optional for foundation schedules
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
grant execute on function public.process_due_scheduled_notifications(int) to service_role;

-- =============================================================================
-- 10. Mark read enhancements
-- =============================================================================

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  update public.user_notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id
    and user_id = auth.uid();
end;
$$;

create or replace function public.mark_notification_unread(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  update public.user_notifications
  set read_at = null
  where id = p_notification_id
    and user_id = auth.uid();
end;
$$;

create or replace function public.mark_all_notifications_read(
  p_household_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.user_notifications
  set read_at = coalesce(read_at, now())
  where user_id = auth.uid()
    and read_at is null
    and (p_household_id is null or household_id = p_household_id);

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.mark_notification_read(uuid) from public;
revoke all on function public.mark_notification_unread(uuid) from public;
revoke all on function public.mark_all_notifications_read(uuid) from public;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_notification_unread(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read(uuid) to authenticated;

-- =============================================================================
-- 11. Test notification enqueue (rate-limited, fixed content)
-- =============================================================================

create or replace function public.enqueue_test_notification()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_recent timestamptz;
  v_key text;
  v_event_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select max(e.created_at) into v_recent
  from public.notification_events e
  join public.user_notifications un on un.event_id = e.id
  where e.event_type = 'system.test_push'
    and un.user_id = v_uid;

  if v_recent is not null and v_recent > now() - interval '60 seconds' then
    raise exception 'Test notification rate limit: wait 60 seconds';
  end if;

  v_key := 'system.test_push:' || v_uid::text || ':' || floor(extract(epoch from now()))::bigint::text;

  v_event_id := public._emit_notification_event(
    null,
    'system.test_push',
    'system',
    v_uid,
    null,
    jsonb_build_object('source_type', 'system', 'source_id', v_uid),
    v_key,
    array[v_uid],
    'HouseholdOS test notification',
    'This is a fixed test push from HouseholdOS. No user-supplied content.',
    null
  );

  -- Ensure web_push is claimable immediately (bypass quiet hours for explicit test).
  update public.notification_deliveries
  set
    status = 'queued',
    available_at = now(),
    failure_category = null,
    failure_code = null,
    next_attempt_at = null,
    updated_at = now()
  where event_id = v_event_id
    and user_id = v_uid
    and channel = 'web_push';

  return v_event_id;
end;
$$;

revoke all on function public.enqueue_test_notification() from public;
grant execute on function public.enqueue_test_notification() to authenticated;

-- =============================================================================
-- 12. Update cleanup_test_household_data
-- =============================================================================

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

-- =============================================================================
-- Grants reminder: ordinary clients cannot claim or mutate delivery status.
-- =============================================================================

-- Deliveries remain SELECT-only for authenticated (existing payment_rls grants).
-- Explicitly ensure no INSERT/UPDATE/DELETE for authenticated on deliveries/events.
revoke insert, update, delete on table public.notification_deliveries from authenticated;
revoke insert, update, delete on table public.notification_events from authenticated;
revoke insert, delete on table public.user_notifications from authenticated;

-- =============================================================================
-- OPERATOR SETUP (do not run with secrets in migration):
-- 1. Store NOTIFICATION_WORKER_SECRET and worker URL in Supabase Vault
-- 2. Enable pg_net / pg_cron
-- 3. Schedule every minute: HTTP POST to the worker with Authorization: Bearer <secret>
-- 4. Worker should call claim_notification_deliveries / complete_* / fail_* with service_role
-- Scheduler remains disabled until secrets are configured.
-- Example (configure outside migrations; never embed secrets here):
--   select cron.schedule(
--     'notification-dispatch',
--     '* * * * *',
--     $$select net.http_post(
--        url := '<worker-url>',
--        headers := jsonb_build_object(
--          'Authorization', 'Bearer ' || '<from-vault>',
--          'Content-Type', 'application/json'
--        ),
--        body := '{}'::jsonb
--      );$$
--   );
-- =============================================================================
