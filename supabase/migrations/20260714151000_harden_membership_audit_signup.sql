-- Phase 1B: harden membership mutations, audit writes, and Auth signup gating.
-- Additive migration on top of foundation schema already applied remotely.

-- ---------------------------------------------------------------------------
-- 1) Membership: deny direct UPDATE for ordinary clients (RPCs are SECURITY DEFINER)
-- ---------------------------------------------------------------------------
drop policy if exists memberships_update_self_or_coordinator
  on public.household_memberships;

-- Remove authenticated INSERT into membership_roles; bootstrap create_household is definer.
drop policy if exists membership_roles_insert_bootstrap
  on public.household_membership_roles;

-- Prevent identity field tampering even from privileged paths that forget checks
create or replace function public.enforce_membership_immutable_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.household_id is distinct from old.household_id then
      raise exception 'household_id is immutable on memberships';
    end if;
    if new.user_id is distinct from old.user_id then
      raise exception 'user_id is immutable on memberships';
    end if;
    if new.id is distinct from old.id then
      raise exception 'membership id is immutable';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists household_memberships_immutable_identity
  on public.household_memberships;

create trigger household_memberships_immutable_identity
  before update on public.household_memberships
  for each row execute function public.enforce_membership_immutable_identity();

-- ---------------------------------------------------------------------------
-- 2) Audit: remove direct INSERT; trusted writer derives actor from auth.uid()
-- ---------------------------------------------------------------------------
drop policy if exists audit_insert_member on public.audit_events;

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
    'household.archived'
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

  -- Reject payloads that look like secrets
  if coalesce(p_before_state::text, '') ~* '(password|token_hash|secret|service_role)'
     or coalesce(p_after_state::text, '') ~* '(password|token_hash|secret|service_role)' then
    raise exception 'Audit payload contains forbidden fields';
  end if;

  insert into public.audit_events (
    household_id,
    actor_user_id,
    entity_type,
    entity_id,
    event_type,
    before_state,
    after_state,
    reason,
    correlation_id,
    created_at
  ) values (
    p_household_id,
    v_user_id,
    trim(p_entity_type),
    p_entity_id,
    p_event_type,
    p_before_state,
    p_after_state,
    p_reason,
    coalesce(p_correlation_id, gen_random_uuid()),
    now()
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.write_audit_event(
  uuid, text, uuid, text, jsonb, jsonb, text, uuid
) from public;
grant execute on function public.write_audit_event(
  uuid, text, uuid, text, jsonb, jsonb, text, uuid
) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Auth registration policy + Before User Created hook (Postgres)
-- ---------------------------------------------------------------------------
create table if not exists public.auth_registration_policy (
  id integer primary key default 1 check (id = 1),
  mode text not null default 'invite_only'
    check (mode in ('bootstrap_only', 'invite_only', 'open')),
  bootstrap_email text,
  allow_test_emails boolean not null default true,
  test_email_domain text not null default 'hos-itest.local',
  updated_at timestamptz not null default now()
);

alter table public.auth_registration_policy enable row level security;

-- No policies for authenticated/anon: only service role / definer may read-write.
-- Seed row for development; operators update via Dashboard SQL or privileged client.
insert into public.auth_registration_policy (
  id, mode, bootstrap_email, allow_test_emails, test_email_domain
) values (
  1, 'invite_only', null, true, 'hos-itest.local'
)
on conflict (id) do nothing;

create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_mode text;
  v_bootstrap text;
  v_allow_test boolean;
  v_test_domain text;
  v_has_invite boolean;
begin
  v_email := lower(trim(coalesce(event->'user'->>'email', '')));

  if v_email = '' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'message', 'Registration is not available.',
        'http_code', 403
      )
    );
  end if;

  select mode, bootstrap_email, allow_test_emails, test_email_domain
  into v_mode, v_bootstrap, v_allow_test, v_test_domain
  from public.auth_registration_policy
  where id = 1;

  if not found then
    v_mode := 'invite_only';
    v_allow_test := false;
  end if;

  if v_mode = 'open' then
    return '{}'::jsonb;
  end if;

  -- Controlled integration-test users (domain locked, never trust client metadata)
  if coalesce(v_allow_test, false)
     and v_test_domain is not null
     and v_email like ('%@' || lower(v_test_domain)) then
    return '{}'::jsonb;
  end if;

  if v_bootstrap is not null and v_email = lower(trim(v_bootstrap)) then
    return '{}'::jsonb;
  end if;

  -- Valid pending (non-expired, non-revoked) invitation — do not consume
  select exists (
    select 1
    from public.household_invitations i
    where lower(i.invited_email) = v_email
      and i.status = 'pending'
      and i.expires_at > now()
  ) into v_has_invite;

  if v_has_invite then
    return '{}'::jsonb;
  end if;

  -- Generic denial (no account/invite leakage)
  return jsonb_build_object(
    'error', jsonb_build_object(
      'message', 'Registration is not available.',
      'http_code', 403
    )
  );
end;
$$;

revoke all on function public.hook_before_user_created(jsonb) from public;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
-- Ensure authenticated/anon cannot call the Auth hook directly
revoke execute on function public.hook_before_user_created(jsonb) from authenticated, anon;

comment on function public.hook_before_user_created(jsonb) is
  'Supabase Auth Before User Created hook. Activate in Dashboard: Auth > Hooks > Before User Created → Postgres function public.hook_before_user_created. URI: pg-functions://postgres/public/hook_before_user_created';
