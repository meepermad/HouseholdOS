-- Transactional mutation RPCs with audit events

create or replace function public.create_household(
  p_name text,
  p_slug text,
  p_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_household_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if char_length(trim(p_name)) < 2 then
    raise exception 'Household name too short';
  end if;

  insert into public.households (name, slug, created_by)
  values (trim(p_name), trim(p_slug), v_user_id)
  returning id into v_household_id;

  insert into public.household_memberships (household_id, user_id, role, status)
  values (v_household_id, v_user_id, 'owner', 'active');

  insert into public.household_settings (household_id, display_name)
  values (v_household_id, coalesce(nullif(trim(p_display_name), ''), trim(p_name)));

  insert into public.audit_events (
    household_id, actor_user_id, entity_type, entity_id, action, after_state
  ) values (
    v_household_id,
    v_user_id,
    'household',
    v_household_id,
    'household.created',
    jsonb_build_object('name', trim(p_name), 'slug', trim(p_slug))
  );

  return v_household_id;
end;
$$;

create or replace function public.accept_household_invitation(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_invite public.household_invitations%rowtype;
  v_membership_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select email into v_email from auth.users where id = v_user_id;

  select * into v_invite
  from public.household_invitations
  where token_hash = p_token_hash
  for update;

  if not found then
    raise exception 'Invitation not found';
  end if;

  if v_invite.status <> 'pending' then
    raise exception 'Invitation is not pending';
  end if;

  if v_invite.expires_at < now() then
    update public.household_invitations
      set status = 'expired'
      where id = v_invite.id;
    raise exception 'Invitation expired';
  end if;

  if lower(v_invite.email) <> lower(v_email) then
    raise exception 'Invitation email does not match signed-in user';
  end if;

  insert into public.household_memberships (household_id, user_id, role, status)
  values (v_invite.household_id, v_user_id, v_invite.role, 'active')
  on conflict (household_id, user_id) do update
    set role = excluded.role,
        status = 'active',
        left_at = null,
        joined_at = now()
  returning id into v_membership_id;

  update public.household_invitations
    set status = 'accepted',
        accepted_at = now()
    where id = v_invite.id;

  insert into public.audit_events (
    household_id, actor_user_id, entity_type, entity_id, action, after_state, metadata
  ) values (
    v_invite.household_id,
    v_user_id,
    'membership',
    v_membership_id,
    'member.joined',
    jsonb_build_object('role', v_invite.role, 'user_id', v_user_id),
    jsonb_build_object('invitation_id', v_invite.id)
  );

  return v_invite.household_id;
end;
$$;

revoke all on function public.create_household(text, text, text) from public;
revoke all on function public.accept_household_invitation(text) from public;
grant execute on function public.create_household(text, text, text) to authenticated;
grant execute on function public.accept_household_invitation(text) to authenticated;
