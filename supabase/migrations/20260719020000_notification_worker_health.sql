-- Phase 4: privacy-safe notification worker heartbeat and coordinator health RPC.

create table if not exists public.notification_worker_heartbeats (
  id uuid primary key default '00000000-0000-0000-0000-000000000001'::uuid,
  last_attempted_at timestamptz not null,
  last_successful_at timestamptz,
  delivery_enabled boolean not null,
  claimed integer not null default 0 check (claimed >= 0),
  sent integer not null default 0 check (sent >= 0),
  retried integer not null default 0 check (retried >= 0),
  dead_letter integer not null default 0 check (dead_letter >= 0),
  scheduled_processed integer not null default 0 check (scheduled_processed >= 0),
  calendar_horizons_extended integer not null default 0
    check (calendar_horizons_extended >= 0),
  empty boolean not null default true,
  duration_ms integer not null default 0 check (duration_ms >= 0),
  horizon_extension_current boolean not null default true,
  last_horizon_extension_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_worker_heartbeats_singleton
    check (id = '00000000-0000-0000-0000-000000000001'::uuid)
);

comment on table public.notification_worker_heartbeats is
  'Singleton operational heartbeat. Contains counters and timestamps only; never secrets, payloads, endpoints, tokens, or provider data.';

alter table public.notification_worker_heartbeats enable row level security;
-- Intentionally no authenticated/anon policies. Coordinators use the safe RPC.
revoke all on table public.notification_worker_heartbeats from public;
revoke all on table public.notification_worker_heartbeats from anon;
revoke all on table public.notification_worker_heartbeats from authenticated;
grant all on table public.notification_worker_heartbeats to service_role;

create or replace function public.record_notification_worker_heartbeat(
  p_delivery_enabled boolean,
  p_claimed integer default 0,
  p_sent integer default 0,
  p_retried integer default 0,
  p_dead_letter integer default 0,
  p_scheduled_processed integer default 0,
  p_calendar_horizons_extended integer default 0,
  p_empty boolean default true,
  p_duration_ms integer default 0,
  p_successful boolean default true,
  p_horizon_extension_current boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  if coalesce(auth.jwt() ->> 'role', '') is distinct from 'service_role' then
    raise exception 'record_notification_worker_heartbeat requires service_role';
  end if;

  insert into public.notification_worker_heartbeats (
    id, last_attempted_at, last_successful_at, delivery_enabled,
    claimed, sent, retried, dead_letter, scheduled_processed,
    calendar_horizons_extended, empty, duration_ms,
    horizon_extension_current, last_horizon_extension_at, updated_at
  ) values (
    '00000000-0000-0000-0000-000000000001'::uuid,
    v_now,
    case when p_successful then v_now else null end,
    coalesce(p_delivery_enabled, false),
    greatest(coalesce(p_claimed, 0), 0),
    greatest(coalesce(p_sent, 0), 0),
    greatest(coalesce(p_retried, 0), 0),
    greatest(coalesce(p_dead_letter, 0), 0),
    greatest(coalesce(p_scheduled_processed, 0), 0),
    greatest(coalesce(p_calendar_horizons_extended, 0), 0),
    coalesce(p_empty, true),
    greatest(coalesce(p_duration_ms, 0), 0),
    coalesce(p_horizon_extension_current, true),
    case when coalesce(p_calendar_horizons_extended, 0) > 0 then v_now else null end,
    v_now
  )
  on conflict (id) do update set
    last_attempted_at = excluded.last_attempted_at,
    last_successful_at = case
      when p_successful then excluded.last_attempted_at
      else public.notification_worker_heartbeats.last_successful_at
    end,
    delivery_enabled = excluded.delivery_enabled,
    claimed = excluded.claimed,
    sent = excluded.sent,
    retried = excluded.retried,
    dead_letter = excluded.dead_letter,
    scheduled_processed = excluded.scheduled_processed,
    calendar_horizons_extended = excluded.calendar_horizons_extended,
    empty = excluded.empty,
    duration_ms = excluded.duration_ms,
    horizon_extension_current = excluded.horizon_extension_current,
    last_horizon_extension_at = case
      when excluded.calendar_horizons_extended > 0 then excluded.last_attempted_at
      else public.notification_worker_heartbeats.last_horizon_extension_at
    end,
    updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.record_notification_worker_heartbeat(
  boolean, integer, integer, integer, integer, integer, integer,
  boolean, integer, boolean, boolean
) from public;
revoke all on function public.record_notification_worker_heartbeat(
  boolean, integer, integer, integer, integer, integer, integer,
  boolean, integer, boolean, boolean
) from authenticated;
grant execute on function public.record_notification_worker_heartbeat(
  boolean, integer, integer, integer, integer, integer, integer,
  boolean, integer, boolean, boolean
) to service_role;

create or replace function public.get_notification_worker_health(
  p_household_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_heartbeat public.notification_worker_heartbeats%rowtype;
  v_oldest_queued timestamptz;
  v_oldest_due timestamptz;
  v_retrying_count integer := 0;
  v_dead_letter_count integer := 0;
  v_horizons_needing_extension integer := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.household_memberships m
    join public.household_membership_roles r on r.membership_id = m.id
    where m.household_id = p_household_id
      and m.user_id = v_uid
      and m.status = 'active'
      and r.role = 'household_coordinator'
  ) then
    raise exception 'Household coordinator access required';
  end if;

  select * into v_heartbeat
  from public.notification_worker_heartbeats
  where id = '00000000-0000-0000-0000-000000000001'::uuid;

  select min(d.created_at) into v_oldest_queued
  from public.notification_deliveries d
  where d.status in ('queued', 'pending');

  select min(r.scheduled_at) into v_oldest_due
  from public.scheduled_notification_requests r
  where r.processed_at is null
    and r.cancelled_at is null
    and r.scheduled_at <= now();

  select count(*)::integer into v_retrying_count
  from public.notification_deliveries d
  where d.status = 'retry';

  select count(*)::integer into v_dead_letter_count
  from public.notification_deliveries d
  where d.status = 'dead_letter';

  -- Keep this predicate identical to claim_calendar_horizon_extensions.
  select count(*)::integer into v_horizons_needing_extension
  from public.calendar_events e
  where e.rrule is not null
    and e.status = 'scheduled'
    and (
      e.materialized_through is null
      or e.materialized_through < now() + interval '60 days'
    );

  return jsonb_build_object(
    'last_attempted_at', v_heartbeat.last_attempted_at,
    'last_successful_at', v_heartbeat.last_successful_at,
    'oldest_queued_delivery_at', v_oldest_queued,
    'oldest_due_scheduled_reminder_at', v_oldest_due,
    'retrying_count', v_retrying_count,
    'dead_letter_count', v_dead_letter_count,
    'horizons_needing_extension_count', v_horizons_needing_extension,
    'last_horizon_extension_at', v_heartbeat.last_horizon_extension_at,
    'horizon_extension_current',
      coalesce(v_heartbeat.horizon_extension_current, false)
      and v_horizons_needing_extension = 0,
    'delivery_enabled', coalesce(v_heartbeat.delivery_enabled, false),
    'worker_configured', v_heartbeat.last_attempted_at is not null,
    'claimed', coalesce(v_heartbeat.claimed, 0),
    'sent', coalesce(v_heartbeat.sent, 0),
    'retried', coalesce(v_heartbeat.retried, 0),
    'scheduled_processed', coalesce(v_heartbeat.scheduled_processed, 0),
    'calendar_horizons_extended',
      coalesce(v_heartbeat.calendar_horizons_extended, 0),
    'empty', coalesce(v_heartbeat.empty, true),
    'duration_ms', coalesce(v_heartbeat.duration_ms, 0)
  );
end;
$$;

revoke all on function public.get_notification_worker_health(uuid) from public;
revoke all on function public.get_notification_worker_health(uuid) from anon;
grant execute on function public.get_notification_worker_health(uuid) to authenticated;
