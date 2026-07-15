-- Phase 2.2: harden transactional household bootstrap.
-- Why SECURITY DEFINER: the creator cannot satisfy membership RLS before the
-- membership row exists; a single atomic definer function inserts household,
-- settings, membership, roles, preference, and audit together without broadly
-- opening INSERT policies on memberships/roles.

create or replace function public.create_household_for_current_user(
  p_name text,
  p_property_nickname text default null,
  p_lease_start date default null,
  p_lease_end date default null,
  p_timezone text default 'America/Chicago',
  p_currency text default 'USD',
  p_purchase_approval_threshold_cents integer default 5000,
  p_acknowledge_reimbursement_policy boolean default false,
  p_idempotency_key text default null
)
returns table (
  household_id uuid,
  membership_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_household_id uuid;
  v_membership_id uuid;
  v_correlation uuid := gen_random_uuid();
  v_timezone text;
  v_currency text;
  v_idempotency text := nullif(trim(coalesce(p_idempotency_key, '')), '');
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  perform public.ensure_profile();

  if char_length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Household name too short';
  end if;

  if p_lease_start is not null and p_lease_end is not null and p_lease_end < p_lease_start then
    raise exception 'Lease end must follow lease start';
  end if;

  v_timezone := coalesce(nullif(trim(coalesce(p_timezone, '')), ''), 'America/Chicago');
  if char_length(v_timezone) < 1 then
    raise exception 'Invalid timezone';
  end if;

  v_currency := upper(trim(coalesce(p_currency, '')));
  if v_currency !~ '^[A-Z]{3}$' then
    raise exception 'Invalid currency';
  end if;

  if p_purchase_approval_threshold_cents is null
     or p_purchase_approval_threshold_cents < 0
     or p_purchase_approval_threshold_cents > 10000000 then
    raise exception 'Invalid purchase approval threshold';
  end if;

  if not coalesce(p_acknowledge_reimbursement_policy, false) then
    raise exception 'Reimbursement policy must be acknowledged';
  end if;

  -- Idempotent retry within 24h for the same authenticated actor + key.
  if v_idempotency is not null then
    select
      (ae.after_state->>'household_id')::uuid,
      (ae.after_state->>'membership_id')::uuid
    into v_household_id, v_membership_id
    from public.audit_events ae
    where ae.actor_user_id = v_user_id
      and ae.event_type = 'household.created'
      and ae.after_state->>'idempotency_key' = v_idempotency
      and ae.created_at > now() - interval '24 hours'
    order by ae.created_at desc
    limit 1;

    if v_household_id is not null and v_membership_id is not null then
      household_id := v_household_id;
      membership_id := v_membership_id;
      return next;
      return;
    end if;
  end if;

  insert into public.households (
    name,
    property_nickname,
    lease_start,
    lease_end,
    timezone,
    currency,
    created_by
  )
  values (
    trim(p_name),
    nullif(trim(coalesce(p_property_nickname, '')), ''),
    p_lease_start,
    p_lease_end,
    v_timezone,
    v_currency,
    v_user_id
  )
  returning id into v_household_id;

  insert into public.household_memberships (household_id, user_id, status, joined_at)
  values (v_household_id, v_user_id, 'active', now())
  returning id into v_membership_id;

  insert into public.household_membership_roles (membership_id, role, granted_by)
  values
    (v_membership_id, 'member', v_user_id),
    (v_membership_id, 'household_coordinator', v_user_id),
    (v_membership_id, 'financial_coordinator', v_user_id);

  insert into public.household_settings (
    household_id,
    purchase_approval_threshold_cents,
    reimbursement_policy_acknowledged_at
  )
  values (
    v_household_id,
    p_purchase_approval_threshold_cents,
    now()
  );

  insert into public.user_preferences (user_id, current_household_id)
  values (v_user_id, v_household_id)
  on conflict (user_id) do update
    set current_household_id = excluded.current_household_id,
        updated_at = now();

  update public.profiles
  set onboarding_status = 'complete',
      onboarding_draft = '{}'::jsonb,
      updated_at = now()
  where id = v_user_id;

  insert into public.audit_events (
    household_id, actor_user_id, entity_type, entity_id, event_type, after_state, correlation_id
  ) values (
    v_household_id,
    v_user_id,
    'household',
    v_household_id,
    'household.created',
    jsonb_build_object(
      'name', trim(p_name),
      'timezone', v_timezone,
      'currency', v_currency,
      'household_id', v_household_id,
      'membership_id', v_membership_id,
      'idempotency_key', v_idempotency
    ),
    v_correlation
  );

  insert into public.audit_events (
    household_id, actor_user_id, entity_type, entity_id, event_type, after_state, correlation_id
  ) values (
    v_household_id,
    v_user_id,
    'membership',
    v_membership_id,
    'membership.status_changed',
    jsonb_build_object('status', 'active', 'bootstrap', true),
    v_correlation
  );

  household_id := v_household_id;
  membership_id := v_membership_id;
  return next;
end;
$$;

revoke all on function public.create_household_for_current_user(
  text, text, date, date, text, text, integer, boolean, text
) from public;
grant execute on function public.create_household_for_current_user(
  text, text, date, date, text, text, integer, boolean, text
) to authenticated;

-- Keep legacy UUID-returning wrapper for existing callers/tests.
create or replace function public.create_household(
  p_name text,
  p_property_nickname text default null,
  p_lease_start date default null,
  p_lease_end date default null,
  p_timezone text default 'America/Chicago',
  p_currency text default 'USD',
  p_purchase_approval_threshold_cents integer default 5000,
  p_acknowledge_reimbursement_policy boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  select * into v_row
  from public.create_household_for_current_user(
    p_name,
    p_property_nickname,
    p_lease_start,
    p_lease_end,
    p_timezone,
    p_currency,
    p_purchase_approval_threshold_cents,
    p_acknowledge_reimbursement_policy,
    null
  );
  return v_row.household_id;
end;
$$;

revoke all on function public.create_household(
  text, text, date, date, text, text, integer, boolean
) from public;
grant execute on function public.create_household(
  text, text, date, date, text, text, integer, boolean
) to authenticated;

comment on function public.create_household_for_current_user(
  text, text, date, date, text, text, integer, boolean, text
) is
  'Atomic household bootstrap for auth.uid(). SECURITY DEFINER because membership RLS cannot authorize the first membership insert before it exists. Does not accept caller-supplied user/membership/creator IDs.';
