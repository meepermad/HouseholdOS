-- Invitation create / preview / accept / decline / revoke

create or replace function public.create_household_invitation(
  p_household_id uuid,
  p_email text,
  p_token_hash text,
  p_expires_at timestamptz,
  p_intended_roles text[] default array['member']::text[],
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_invite_id uuid;
  v_roles text[] := coalesce(p_intended_roles, array['member']::text[]);
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.has_responsibility(p_household_id, array['household_coordinator']) then
    raise exception 'Not allowed to invite members';
  end if;

  if p_token_hash is null or length(p_token_hash) < 32 then
    raise exception 'Invalid token hash';
  end if;

  if p_expires_at <= now() then
    raise exception 'Expiration must be in the future';
  end if;

  if not (v_roles <@ array['member', 'household_coordinator', 'financial_coordinator']::text[]) then
    raise exception 'Invalid intended roles';
  end if;

  -- Always include base member role
  if not ('member' = any (v_roles)) then
    v_roles := array_append(v_roles, 'member');
  end if;

  insert into public.household_invitations (
    household_id,
    invited_email,
    invited_by,
    token_hash,
    intended_roles,
    message,
    expires_at
  )
  values (
    p_household_id,
    lower(trim(p_email)),
    v_user_id,
    p_token_hash,
    v_roles,
    nullif(trim(coalesce(p_message, '')), ''),
    p_expires_at
  )
  returning id into v_invite_id;

  insert into public.audit_events (
    household_id, actor_user_id, entity_type, entity_id, event_type, after_state
  ) values (
    p_household_id,
    v_user_id,
    'invitation',
    v_invite_id,
    'invitation.created',
    jsonb_build_object(
      'invited_email', lower(trim(p_email)),
      'intended_roles', to_jsonb(v_roles),
      'expires_at', p_expires_at
    )
  );

  return v_invite_id;
end;
$$;

revoke all on function public.create_household_invitation(
  uuid, text, text, timestamptz, text[], text
) from public;
grant execute on function public.create_household_invitation(
  uuid, text, text, timestamptz, text[], text
) to authenticated;

-- Minimal preview: no account-existence leaks; works for anon + authenticated
create or replace function public.get_invitation_preview(p_token_hash text)
returns table (
  household_name text,
  property_nickname text,
  expires_at timestamptz,
  status text,
  invited_email_domain text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select
    h.name,
    h.property_nickname,
    i.expires_at,
    case
      when i.status = 'pending' and i.expires_at < now() then 'expired'
      else i.status
    end,
    split_part(i.invited_email, '@', 2)
  from public.household_invitations i
  join public.households h on h.id = i.household_id
  where i.token_hash = p_token_hash
  limit 1;
end;
$$;

revoke all on function public.get_invitation_preview(text) from public;
grant execute on function public.get_invitation_preview(text) to anon, authenticated;

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
  v_role text;
  v_correlation uuid := gen_random_uuid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  perform public.ensure_profile();

  select lower(email) into v_email from auth.users where id = v_user_id;

  select * into v_invite
  from public.household_invitations
  where token_hash = p_token_hash
  for update;

  if not found then
    raise exception 'Invalid invitation';
  end if;

  if v_invite.status = 'accepted' then
    -- Idempotent: already accepted by this user
    select m.id into v_membership_id
    from public.household_memberships m
    where m.household_id = v_invite.household_id
      and m.user_id = v_user_id
      and m.status = 'active';
    if v_membership_id is not null then
      return v_invite.household_id;
    end if;
    raise exception 'Invitation already used';
  end if;

  if v_invite.status = 'revoked' then
    raise exception 'Invitation revoked';
  end if;

  if v_invite.status = 'declined' then
    raise exception 'Invitation declined';
  end if;

  if v_invite.status <> 'pending' or v_invite.expires_at < now() then
    update public.household_invitations
    set status = 'expired'
    where id = v_invite.id and status = 'pending';
    raise exception 'Invitation expired';
  end if;

  if lower(v_invite.invited_email) <> lower(coalesce(v_email, '')) then
    raise exception 'Invitation email mismatch';
  end if;

  insert into public.household_memberships (household_id, user_id, status)
  values (v_invite.household_id, v_user_id, 'active')
  on conflict (household_id, user_id) do update
    set status = 'active',
        left_at = null,
        joined_at = now(),
        updated_at = now()
  returning id into v_membership_id;

  delete from public.household_membership_roles where membership_id = v_membership_id;

  foreach v_role in array v_invite.intended_roles
  loop
    insert into public.household_membership_roles (membership_id, role, granted_by)
    values (v_membership_id, v_role, v_invite.invited_by)
    on conflict (membership_id, role) do nothing;
  end loop;

  if not exists (
    select 1 from public.household_membership_roles
    where membership_id = v_membership_id and role = 'member'
  ) then
    insert into public.household_membership_roles (membership_id, role, granted_by)
    values (v_membership_id, 'member', v_invite.invited_by);
  end if;

  update public.household_invitations
  set status = 'accepted',
      accepted_at = now()
  where id = v_invite.id;

  insert into public.user_preferences (user_id, current_household_id)
  values (v_user_id, v_invite.household_id)
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
    v_invite.household_id,
    v_user_id,
    'invitation',
    v_invite.id,
    'invitation.accepted',
    jsonb_build_object('membership_id', v_membership_id),
    v_correlation
  );

  insert into public.audit_events (
    household_id, actor_user_id, entity_type, entity_id, event_type, after_state, correlation_id
  ) values (
    v_invite.household_id,
    v_user_id,
    'membership',
    v_membership_id,
    'membership.status_changed',
    jsonb_build_object('status', 'active'),
    v_correlation
  );

  return v_invite.household_id;
end;
$$;

revoke all on function public.accept_household_invitation(text) from public;
grant execute on function public.accept_household_invitation(text) to authenticated;

create or replace function public.decline_household_invitation(p_token_hash text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_invite public.household_invitations%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select lower(email) into v_email from auth.users where id = v_user_id;

  select * into v_invite
  from public.household_invitations
  where token_hash = p_token_hash
  for update;

  if not found then
    raise exception 'Invalid invitation';
  end if;

  if v_invite.status <> 'pending' or v_invite.expires_at < now() then
    raise exception 'Invitation is not pending';
  end if;

  if lower(v_invite.invited_email) <> lower(coalesce(v_email, '')) then
    raise exception 'Invitation email mismatch';
  end if;

  update public.household_invitations
  set status = 'declined',
      declined_at = now()
  where id = v_invite.id;

  insert into public.audit_events (
    household_id, actor_user_id, entity_type, entity_id, event_type
  ) values (
    v_invite.household_id,
    v_user_id,
    'invitation',
    v_invite.id,
    'invitation.declined'
  );
end;
$$;

revoke all on function public.decline_household_invitation(text) from public;
grant execute on function public.decline_household_invitation(text) to authenticated;

create or replace function public.revoke_household_invitation(
  p_household_id uuid,
  p_invitation_id uuid
)
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
    raise exception 'Not allowed to revoke invitations';
  end if;

  update public.household_invitations
  set status = 'revoked',
      revoked_at = now()
  where id = p_invitation_id
    and household_id = p_household_id
    and status = 'pending';

  if not found then
    raise exception 'Invitation not found or not pending';
  end if;

  insert into public.audit_events (
    household_id, actor_user_id, entity_type, entity_id, event_type
  ) values (
    p_household_id,
    v_user_id,
    'invitation',
    p_invitation_id,
    'invitation.revoked'
  );
end;
$$;

revoke all on function public.revoke_household_invitation(uuid, uuid) from public;
grant execute on function public.revoke_household_invitation(uuid, uuid) to authenticated;
