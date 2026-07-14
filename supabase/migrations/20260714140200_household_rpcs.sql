-- Household creation and settings RPCs

create or replace function public.ensure_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_meta jsonb;
  v_profile public.profiles;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select email, raw_user_meta_data into v_email, v_meta
  from auth.users
  where id = v_user_id;

  insert into public.profiles (id, email, display_name)
  values (
    v_user_id,
    lower(coalesce(v_email, '')),
    coalesce(v_meta->>'display_name', split_part(coalesce(v_email, 'user'), '@', 1))
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now()
  returning * into v_profile;

  insert into public.user_preferences (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  return v_profile;
end;
$$;

revoke all on function public.ensure_profile() from public;
grant execute on function public.ensure_profile() to authenticated;

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
  v_user_id uuid := auth.uid();
  v_household_id uuid;
  v_membership_id uuid;
  v_correlation uuid := gen_random_uuid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  perform public.ensure_profile();

  if char_length(trim(p_name)) < 2 then
    raise exception 'Household name too short';
  end if;

  if p_currency is null or p_currency !~ '^[A-Z]{3}$' then
    raise exception 'Invalid currency';
  end if;

  if not coalesce(p_acknowledge_reimbursement_policy, false) then
    raise exception 'Reimbursement policy must be acknowledged';
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
    coalesce(nullif(trim(p_timezone), ''), 'America/Chicago'),
    p_currency,
    v_user_id
  )
  returning id into v_household_id;

  insert into public.household_memberships (household_id, user_id, status)
  values (v_household_id, v_user_id, 'active')
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
    greatest(coalesce(p_purchase_approval_threshold_cents, 5000), 0),
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
      'timezone', coalesce(nullif(trim(p_timezone), ''), 'America/Chicago'),
      'currency', p_currency
    ),
    v_correlation
  );

  return v_household_id;
end;
$$;

revoke all on function public.create_household(
  text, text, date, date, text, text, integer, boolean
) from public;
grant execute on function public.create_household(
  text, text, date, date, text, text, integer, boolean
) to authenticated;

create or replace function public.set_current_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_active_member(p_household_id) then
    raise exception 'Not an active member of this household';
  end if;

  insert into public.user_preferences (user_id, current_household_id)
  values (v_user_id, p_household_id)
  on conflict (user_id) do update
    set current_household_id = excluded.current_household_id,
        updated_at = now();
end;
$$;

revoke all on function public.set_current_household(uuid) from public;
grant execute on function public.set_current_household(uuid) to authenticated;
