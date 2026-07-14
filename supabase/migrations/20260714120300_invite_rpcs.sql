-- Invite + other audited helpers

create or replace function public.create_household_invitation(
  p_household_id uuid,
  p_email text,
  p_role text,
  p_token_hash text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_invite_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.has_household_role(p_household_id, array['owner', 'admin']) then
    raise exception 'Not allowed to invite';
  end if;

  if p_role not in ('admin', 'member') then
    raise exception 'Invalid invite role';
  end if;

  insert into public.household_invitations (
    household_id, email, role, token_hash, invited_by, expires_at
  ) values (
    p_household_id, lower(trim(p_email)), p_role, p_token_hash, v_user_id, p_expires_at
  )
  returning id into v_invite_id;

  insert into public.audit_events (
    household_id, actor_user_id, entity_type, entity_id, action, after_state
  ) values (
    p_household_id,
    v_user_id,
    'invitation',
    v_invite_id,
    'member.invited',
    jsonb_build_object('email', lower(trim(p_email)), 'role', p_role)
  );

  return v_invite_id;
end;
$$;

create or replace function public.get_invitation_preview(p_token_hash text)
returns table (
  invitation_id uuid,
  household_id uuid,
  household_name text,
  email text,
  role text,
  status text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    i.id,
    i.household_id,
    h.name,
    i.email,
    i.role,
    i.status,
    i.expires_at
  from public.household_invitations i
  join public.households h on h.id = i.household_id
  where i.token_hash = p_token_hash;
end;
$$;

revoke all on function public.create_household_invitation(uuid, text, text, text, timestamptz) from public;
revoke all on function public.get_invitation_preview(text) from public;
grant execute on function public.create_household_invitation(uuid, text, text, text, timestamptz) to authenticated;
grant execute on function public.get_invitation_preview(text) to authenticated, anon;
