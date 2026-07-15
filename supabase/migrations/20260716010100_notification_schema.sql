-- Phase 3: durable notification outbox + in-app notifications

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households (id) on delete restrict,
  event_type text not null,
  entity_type text not null,
  entity_id uuid not null,
  actor_membership_id uuid references public.household_memberships (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (idempotency_key)
);

create index notification_events_household_idx
  on public.notification_events (household_id, created_at desc);
create index notification_events_entity_idx
  on public.notification_events (entity_type, entity_id);

create table public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid not null references public.notification_events (id) on delete cascade,
  household_id uuid references public.households (id) on delete restrict,
  title text not null check (char_length(trim(title)) >= 1),
  body text not null default '',
  action_href text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create index user_notifications_user_unread_idx
  on public.user_notifications (user_id, created_at desc)
  where read_at is null;
create index user_notifications_user_idx
  on public.user_notifications (user_id, created_at desc);

-- Delivery metadata reserved for Phase 3.1 (push/email). Kept for forward compatibility.
create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.notification_events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  channel text not null check (channel in ('in_app', 'web_push', 'email')),
  status text not null default 'pending' check (status in (
    'pending', 'sent', 'failed', 'skipped'
  )),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  next_attempt_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id, channel)
);

create trigger notification_deliveries_set_updated_at
  before update on public.notification_deliveries
  for each row execute function public.set_updated_at();

-- Outbox insert + in-app fan-out. External channels stay pending for later workers.
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
  v_safe jsonb := coalesce(p_payload, '{}'::jsonb);
begin
  if coalesce(v_safe::text, '') ~* '(password|token_hash|secret|service_role|external_reference|private_note)' then
    raise exception 'Notification payload contains forbidden fields';
  end if;

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
      insert into public.user_notifications (
        user_id, event_id, household_id, title, body, action_href
      ) values (
        v_uid, v_event_id, p_household_id, p_title, coalesce(p_body, ''), p_action_href
      )
      on conflict (event_id, user_id) do nothing;

      insert into public.notification_deliveries (
        event_id, user_id, channel, status
      ) values (
        v_event_id, v_uid, 'in_app', 'sent'
      )
      on conflict (event_id, user_id, channel) do nothing;

      -- Future channels reserved; do not deliver externally in Phase 3.
      insert into public.notification_deliveries (
        event_id, user_id, channel, status
      ) values (
        v_event_id, v_uid, 'web_push', 'pending'
      )
      on conflict (event_id, user_id, channel) do nothing;
    end loop;
  end if;

  return v_event_id;
exception
  when others then
    -- Never block financial commits on notification fan-out failures after outbox attempt.
    -- If the outbox insert itself failed before assign, re-raise to keep transactional pairing.
    if v_event_id is null then
      raise;
    end if;
    raise warning 'notification fan-out failed: %', sqlerrm;
    return v_event_id;
end;
$$;

revoke all on function public._emit_notification_event(uuid, text, text, uuid, uuid, jsonb, text, uuid[], text, text, text) from public;

-- Mark in-app notification read (own rows only)
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

revoke all on function public.mark_notification_read(uuid) from public;
grant execute on function public.mark_notification_read(uuid) to authenticated;
