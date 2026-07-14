-- Membership status and role mutations (audited, no self-promotion)

create or replace function public.change_membership_roles(
  p_household_id uuid,
  p_membership_id uuid,
  p_roles text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_target public.household_memberships%rowtype;
  v_before text[];
  v_roles text[] := coalesce(p_roles, array['member']::text[]);
  v_role text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.has_responsibility(p_household_id, array['household_coordinator']) then
    raise exception 'Not allowed to change roles';
  end if;

  select * into v_target
  from public.household_memberships
  where id = p_membership_id
    and household_id = p_household_id
  for update;

  if not found then
    raise exception 'Membership not found';
  end if;

  if v_target.user_id = v_user_id then
    raise exception 'Cannot change your own roles';
  end if;

  if v_target.status <> 'active' then
    raise exception 'Can only change roles for active members';
  end if;

  if not (v_roles <@ array['member', 'household_coordinator', 'financial_coordinator']::text[]) then
    raise exception 'Invalid roles';
  end if;

  if not ('member' = any (v_roles)) then
    v_roles := array_append(v_roles, 'member');
  end if;

  select coalesce(array_agg(role order by role), array[]::text[])
  into v_before
  from public.household_membership_roles
  where membership_id = p_membership_id;

  delete from public.household_membership_roles where membership_id = p_membership_id;

  foreach v_role in array v_roles
  loop
    insert into public.household_membership_roles (membership_id, role, granted_by)
    values (p_membership_id, v_role, v_user_id);
  end loop;

  insert into public.audit_events (
    household_id, actor_user_id, entity_type, entity_id, event_type, before_state, after_state
  ) values (
    p_household_id,
    v_user_id,
    'membership',
    p_membership_id,
    'membership.roles_changed',
    jsonb_build_object('roles', to_jsonb(v_before)),
    jsonb_build_object('roles', to_jsonb(v_roles))
  );
end;
$$;

revoke all on function public.change_membership_roles(uuid, uuid, text[]) from public;
grant execute on function public.change_membership_roles(uuid, uuid, text[]) to authenticated;

create or replace function public.remove_household_member(
  p_household_id uuid,
  p_membership_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_target public.household_memberships%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_target
  from public.household_memberships
  where id = p_membership_id
    and household_id = p_household_id
  for update;

  if not found then
    raise exception 'Membership not found';
  end if;

  if v_target.user_id = v_user_id then
    raise exception 'Use leave_household to leave';
  end if;

  if not public.has_responsibility(p_household_id, array['household_coordinator']) then
    raise exception 'Not allowed to remove members';
  end if;

  if v_target.status <> 'active' then
    raise exception 'Member is not active';
  end if;

  update public.household_memberships
  set status = 'removed',
      left_at = now(),
      updated_at = now()
  where id = p_membership_id;

  update public.user_preferences
  set current_household_id = null,
      updated_at = now()
  where user_id = v_target.user_id
    and current_household_id = p_household_id;

  insert into public.audit_events (
    household_id, actor_user_id, entity_type, entity_id, event_type,
    before_state, after_state, reason
  ) values (
    p_household_id,
    v_user_id,
    'membership',
    p_membership_id,
    'membership.status_changed',
    jsonb_build_object('status', v_target.status),
    jsonb_build_object('status', 'removed'),
    p_reason
  );
end;
$$;

revoke all on function public.remove_household_member(uuid, uuid, text) from public;
grant execute on function public.remove_household_member(uuid, uuid, text) to authenticated;

create or replace function public.leave_household(
  p_household_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_membership public.household_memberships%rowtype;
  v_is_coordinator boolean;
  v_other_coordinators integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_membership
  from public.household_memberships
  where household_id = p_household_id
    and user_id = v_user_id
    and status = 'active'
  for update;

  if not found then
    raise exception 'Not an active member';
  end if;

  select exists (
    select 1 from public.household_membership_roles
    where membership_id = v_membership.id
      and role = 'household_coordinator'
  ) into v_is_coordinator;

  if v_is_coordinator then
    select count(*) into v_other_coordinators
    from public.household_memberships m
    join public.household_membership_roles r on r.membership_id = m.id
    where m.household_id = p_household_id
      and m.status = 'active'
      and m.user_id <> v_user_id
      and r.role = 'household_coordinator';

    if v_other_coordinators < 1 then
      raise exception 'Assign another household_coordinator before leaving';
    end if;
  end if;

  update public.household_memberships
  set status = 'former',
      left_at = now(),
      updated_at = now()
  where id = v_membership.id;

  update public.user_preferences
  set current_household_id = null,
      updated_at = now()
  where user_id = v_user_id
    and current_household_id = p_household_id;

  insert into public.audit_events (
    household_id, actor_user_id, entity_type, entity_id, event_type,
    before_state, after_state, reason
  ) values (
    p_household_id,
    v_user_id,
    'membership',
    v_membership.id,
    'membership.status_changed',
    jsonb_build_object('status', 'active'),
    jsonb_build_object('status', 'former'),
    p_reason
  );
end;
$$;

revoke all on function public.leave_household(uuid, text) from public;
grant execute on function public.leave_household(uuid, text) to authenticated;

create or replace function public.archive_household(p_household_id uuid)
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

  if not public.has_responsibility(p_household_id, array['household_coordinator']) then
    raise exception 'Not allowed to archive household';
  end if;

  update public.households
  set status = 'archived',
      archived_at = now(),
      updated_at = now()
  where id = p_household_id
    and status = 'active';

  if not found then
    raise exception 'Household not found or already archived';
  end if;

  insert into public.audit_events (
    household_id, actor_user_id, entity_type, entity_id, event_type, after_state
  ) values (
    p_household_id,
    v_user_id,
    'household',
    p_household_id,
    'household.archived',
    jsonb_build_object('status', 'archived')
  );
end;
$$;

revoke all on function public.archive_household(uuid) from public;
grant execute on function public.archive_household(uuid) to authenticated;
