-- Invitation email-delivery metadata + duplicate-pending prevention.
-- Lifecycle status (pending/accepted/revoked/…) remains authoritative;
-- delivery_status tracks Auth email attempt outcome only.

alter table public.household_invitations
  add column if not exists delivery_status text not null default 'not_attempted'
    check (delivery_status in ('not_attempted', 'sent', 'existing_account', 'failed')),
  add column if not exists delivery_attempted_at timestamptz,
  add column if not exists delivery_error_category text;

comment on column public.household_invitations.delivery_status is
  'Auth email delivery outcome. Does not replace invitation lifecycle status.';
comment on column public.household_invitations.delivery_error_category is
  'Safe error category only (e.g. hook_rejection, signup_disabled). Never raw provider payloads.';

-- Revoke older duplicates so the unique pending index can be applied safely.
with ranked as (
  select
    id,
    row_number() over (
      partition by household_id, lower(invited_email)
      order by created_at desc, id desc
    ) as rn
  from public.household_invitations
  where status = 'pending'
)
update public.household_invitations i
set status = 'revoked',
    revoked_at = coalesce(i.revoked_at, now())
from ranked r
where i.id = r.id
  and r.rn > 1;

-- At most one pending invitation per household + normalized email.
create unique index if not exists household_invitations_pending_email_uidx
  on public.household_invitations (household_id, lower(invited_email))
  where status = 'pending';

-- Replace create_household_invitation: revoke existing pending for same email, then insert.
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
  v_email text := lower(trim(coalesce(p_email, '')));
  v_replaced uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.has_responsibility(p_household_id, array['household_coordinator']) then
    raise exception 'Not allowed to invite members';
  end if;

  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'Invalid email';
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

  if not ('member' = any (v_roles)) then
    v_roles := array_append(v_roles, 'member');
  end if;

  -- Explicit replace: revoke any existing pending invite for this household + email.
  update public.household_invitations
  set status = 'revoked',
      revoked_at = now()
  where household_id = p_household_id
    and lower(invited_email) = v_email
    and status = 'pending'
  returning id into v_replaced;

  if v_replaced is not null then
    insert into public.audit_events (
      household_id, actor_user_id, entity_type, entity_id, event_type, after_state
    ) values (
      p_household_id,
      v_user_id,
      'invitation',
      v_replaced,
      'invitation.revoked',
      jsonb_build_object('reason', 'replaced_by_new_invitation')
    );
  end if;

  insert into public.household_invitations (
    household_id,
    invited_email,
    invited_by,
    token_hash,
    intended_roles,
    message,
    expires_at,
    delivery_status
  )
  values (
    p_household_id,
    v_email,
    v_user_id,
    p_token_hash,
    v_roles,
    nullif(trim(coalesce(p_message, '')), ''),
    p_expires_at,
    'not_attempted'
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
      'invited_email', v_email,
      'intended_roles', to_jsonb(v_roles),
      'expires_at', p_expires_at,
      'replaced_invitation_id', v_replaced
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

-- Safe delivery outcome update (coordinator only). Never accepts raw provider payloads.
create or replace function public.record_invitation_delivery(
  p_household_id uuid,
  p_invitation_id uuid,
  p_delivery_status text,
  p_error_category text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_category text := nullif(trim(coalesce(p_error_category, '')), '');
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.has_responsibility(p_household_id, array['household_coordinator']) then
    raise exception 'Not allowed to update invitation delivery';
  end if;

  if p_delivery_status not in ('not_attempted', 'sent', 'existing_account', 'failed') then
    raise exception 'Invalid delivery status';
  end if;

  -- Bound category length; strip anything that looks like a secret/token.
  if v_category is not null then
    if length(v_category) > 64 then
      v_category := left(v_category, 64);
    end if;
    if v_category ~* '(token|secret|password|bearer|apikey|authorization)' then
      v_category := 'redacted';
    end if;
  end if;

  update public.household_invitations
  set delivery_status = p_delivery_status,
      delivery_attempted_at = now(),
      delivery_error_category = case
        when p_delivery_status in ('failed') then v_category
        else null
      end
  where id = p_invitation_id
    and household_id = p_household_id
    and status = 'pending';

  if not found then
    raise exception 'Invitation not found or not pending';
  end if;
end;
$$;

revoke all on function public.record_invitation_delivery(uuid, uuid, text, text) from public;
grant execute on function public.record_invitation_delivery(uuid, uuid, text, text) to authenticated;
