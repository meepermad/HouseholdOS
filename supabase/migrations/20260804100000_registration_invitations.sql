-- Independent household creation invitations (registration grants).
-- join_household continues to use household_invitations unchanged.
-- create_household registration grants live in registration_invitations.
-- Database purpose remains authoritative; client metadata is never trusted.

-- ---------------------------------------------------------------------------
-- Platform issuers allowlist (not derived from household membership)
-- ---------------------------------------------------------------------------
create table if not exists public.platform_registration_issuers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  note text,
  constraint platform_registration_issuers_email_normalized
    check (email = lower(trim(email))),
  constraint platform_registration_issuers_email_unique unique (email)
);

comment on table public.platform_registration_issuers is
  'Allowlisted emails permitted to issue create_household registration invitations. Bootstrap email from auth_registration_policy is also an issuer.';

alter table public.platform_registration_issuers enable row level security;
-- No authenticated/anon policies: managed via service role / Dashboard SQL.

-- Seed bootstrap email when present.
insert into public.platform_registration_issuers (email, note)
select lower(trim(bootstrap_email)), 'seeded from auth_registration_policy.bootstrap_email'
from public.auth_registration_policy
where id = 1
  and bootstrap_email is not null
  and length(trim(bootstrap_email)) > 0
on conflict (email) do nothing;

-- ---------------------------------------------------------------------------
-- registration_invitations
-- ---------------------------------------------------------------------------
create table if not exists public.registration_invitations (
  id uuid primary key default gen_random_uuid(),
  invited_email text not null,
  purpose text not null
    check (purpose in ('join_household', 'create_household')),
  household_id uuid references public.households (id) on delete restrict,
  intended_roles text[] not null default '{}'::text[],
  token_hash text not null,
  status text not null default 'pending'
    check (status in ('pending', 'consumed', 'revoked', 'expired')),
  expires_at timestamptz not null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  revoked_at timestamptz,
  auth_user_id uuid references public.profiles (id) on delete set null,
  delivery_status text not null default 'not_attempted'
    check (delivery_status in ('not_attempted', 'sent', 'existing_account', 'failed')),
  delivery_attempted_at timestamptz,
  delivery_error_category text,
  constraint registration_invitations_token_hash_unique unique (token_hash),
  constraint registration_invitations_email_normalized
    check (invited_email = lower(trim(invited_email))),
  constraint registration_invitations_purpose_shape check (
    (
      purpose = 'create_household'
      and household_id is null
      and intended_roles = '{}'::text[]
    )
    or (
      purpose = 'join_household'
      and household_id is not null
      and cardinality(intended_roles) >= 1
      and intended_roles <@ array['member', 'household_coordinator', 'financial_coordinator']::text[]
    )
  )
);

comment on table public.registration_invitations is
  'Registration grants. create_household authorizes independent household setup; join_household is reserved (membership invites remain on household_invitations).';
comment on column public.registration_invitations.purpose is
  'Authoritative invitation purpose. Never trust client metadata alone.';

create index if not exists registration_invitations_email_idx
  on public.registration_invitations (lower(invited_email));
create index if not exists registration_invitations_status_idx
  on public.registration_invitations (status, expires_at);
create unique index if not exists registration_invitations_pending_email_purpose_uidx
  on public.registration_invitations (purpose, lower(invited_email))
  where status = 'pending';

alter table public.registration_invitations enable row level security;

-- Issuers may read invitations they created; invitee email match for pending only.
create policy registration_invitations_select_issuer_or_invitee
  on public.registration_invitations
  for select
  to authenticated
  using (
    created_by = auth.uid()
    or (
      status = 'pending'
      and lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

-- Mutations go through SECURITY DEFINER RPCs only.
create policy registration_invitations_no_direct_insert
  on public.registration_invitations
  for insert
  to authenticated
  with check (false);

create policy registration_invitations_no_direct_update
  on public.registration_invitations
  for update
  to authenticated
  using (false);

create policy registration_invitations_no_direct_delete
  on public.registration_invitations
  for delete
  to authenticated
  using (false);

-- ---------------------------------------------------------------------------
-- Authorization helpers
-- ---------------------------------------------------------------------------
create or replace function public.can_issue_registration_invitations()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_bootstrap text;
begin
  if auth.uid() is null or v_email = '' then
    return false;
  end if;

  if exists (
    select 1
    from public.platform_registration_issuers i
    where i.email = v_email
  ) then
    return true;
  end if;

  select lower(trim(bootstrap_email))
  into v_bootstrap
  from public.auth_registration_policy
  where id = 1;

  return v_bootstrap is not null and v_bootstrap = v_email;
end;
$$;

revoke all on function public.can_issue_registration_invitations() from public;
grant execute on function public.can_issue_registration_invitations() to authenticated;

comment on function public.can_issue_registration_invitations() is
  'True when the authenticated user may issue create_household registration invitations (platform allowlist or bootstrap email). Not derived from household membership.';

-- ---------------------------------------------------------------------------
-- Create create_household registration invitation
-- ---------------------------------------------------------------------------
create or replace function public.create_registration_invitation(
  p_email text,
  p_token_hash text,
  p_expires_at timestamptz,
  p_purpose text default 'create_household',
  p_household_id uuid default null,
  p_intended_roles text[] default '{}'::text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_invite_id uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_roles text[] := coalesce(p_intended_roles, '{}'::text[]);
  v_replaced uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.can_issue_registration_invitations() then
    raise exception 'Not allowed to issue registration invitations';
  end if;

  if p_purpose is distinct from 'create_household' then
    raise exception 'Only create_household registration invitations are supported here';
  end if;

  if p_household_id is not null then
    raise exception 'create_household invitations must not include a household_id';
  end if;

  if cardinality(v_roles) > 0 then
    raise exception 'create_household invitations must not include household roles';
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

  perform public.ensure_profile();

  update public.registration_invitations
  set status = 'revoked',
      revoked_at = now()
  where purpose = 'create_household'
    and lower(invited_email) = v_email
    and status = 'pending'
  returning id into v_replaced;

  if v_replaced is not null then
    insert into public.audit_events (
      household_id, actor_user_id, entity_type, entity_id, event_type, after_state
    ) values (
      null,
      v_user_id,
      'registration_invitation',
      v_replaced,
      'registration_invitation.revoked',
      jsonb_build_object(
        'reason', 'replaced_by_new_invitation',
        'purpose', 'create_household'
      )
    );
  end if;

  insert into public.registration_invitations (
    invited_email,
    purpose,
    household_id,
    intended_roles,
    token_hash,
    status,
    expires_at,
    created_by,
    delivery_status
  )
  values (
    v_email,
    'create_household',
    null,
    '{}'::text[],
    p_token_hash,
    'pending',
    p_expires_at,
    v_user_id,
    'not_attempted'
  )
  returning id into v_invite_id;

  insert into public.audit_events (
    household_id, actor_user_id, entity_type, entity_id, event_type, after_state
  ) values (
    null,
    v_user_id,
    'registration_invitation',
    v_invite_id,
    'registration_invitation.created',
    jsonb_build_object(
      'invited_email', v_email,
      'purpose', 'create_household',
      'expires_at', p_expires_at,
      'replaced_invitation_id', v_replaced
    )
  );

  return v_invite_id;
end;
$$;

revoke all on function public.create_registration_invitation(
  text, text, timestamptz, text, uuid, text[]
) from public;
grant execute on function public.create_registration_invitation(
  text, text, timestamptz, text, uuid, text[]
) to authenticated;

-- ---------------------------------------------------------------------------
-- Preview (safe; no account existence leakage)
-- ---------------------------------------------------------------------------
create or replace function public.get_registration_invitation_preview(p_token_hash text)
returns table (
  purpose text,
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
    i.purpose,
    i.expires_at,
    case
      when i.status = 'pending' and i.expires_at < now() then 'expired'
      else i.status
    end,
    split_part(i.invited_email, '@', 2)
  from public.registration_invitations i
  where i.token_hash = p_token_hash
  limit 1;
end;
$$;

revoke all on function public.get_registration_invitation_preview(text) from public;
grant execute on function public.get_registration_invitation_preview(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Consume (single-use). Safer lifecycle: consume on successful claim after auth.
-- ---------------------------------------------------------------------------
create or replace function public.consume_registration_invitation(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_row public.registration_invitations%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_email = '' then
    raise exception 'Authenticated email required';
  end if;

  select * into v_row
  from public.registration_invitations
  where token_hash = p_token_hash
  for update;

  if not found then
    raise exception 'Invitation not found';
  end if;

  if v_row.status = 'revoked' then
    raise exception 'Invitation revoked';
  end if;

  if v_row.status = 'consumed' then
    raise exception 'Invitation already consumed';
  end if;

  if v_row.status <> 'pending' or v_row.expires_at <= now() then
    raise exception 'Invitation expired';
  end if;

  if lower(v_row.invited_email) <> v_email then
    raise exception 'Invitation email mismatch';
  end if;

  if v_row.purpose <> 'create_household' then
    raise exception 'Unsupported invitation purpose';
  end if;

  update public.registration_invitations
  set status = 'consumed',
      consumed_at = now(),
      auth_user_id = v_user_id
  where id = v_row.id;

  insert into public.audit_events (
    household_id, actor_user_id, entity_type, entity_id, event_type, after_state
  ) values (
    null,
    v_user_id,
    'registration_invitation',
    v_row.id,
    'registration_invitation.consumed',
    jsonb_build_object(
      'purpose', v_row.purpose,
      'invited_email', v_row.invited_email,
      'auth_user_id', v_user_id
    )
  );

  return v_row.id;
end;
$$;

revoke all on function public.consume_registration_invitation(text) from public;
grant execute on function public.consume_registration_invitation(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Revoke / delivery / regenerate support
-- ---------------------------------------------------------------------------
create or replace function public.revoke_registration_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.registration_invitations%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.can_issue_registration_invitations() then
    raise exception 'Not allowed to revoke registration invitations';
  end if;

  select * into v_row
  from public.registration_invitations
  where id = p_invitation_id
  for update;

  if not found then
    raise exception 'Invitation not found';
  end if;

  if v_row.created_by <> v_user_id then
    raise exception 'Not allowed to revoke this invitation';
  end if;

  if v_row.status <> 'pending' then
    raise exception 'Only pending invitations can be revoked';
  end if;

  update public.registration_invitations
  set status = 'revoked',
      revoked_at = now()
  where id = v_row.id;

  insert into public.audit_events (
    household_id, actor_user_id, entity_type, entity_id, event_type, after_state
  ) values (
    null,
    v_user_id,
    'registration_invitation',
    v_row.id,
    'registration_invitation.revoked',
    jsonb_build_object(
      'purpose', v_row.purpose,
      'invited_email', v_row.invited_email
    )
  );
end;
$$;

revoke all on function public.revoke_registration_invitation(uuid) from public;
grant execute on function public.revoke_registration_invitation(uuid) to authenticated;

create or replace function public.record_registration_invitation_delivery(
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

  if not public.can_issue_registration_invitations() then
    raise exception 'Not allowed to update registration invitation delivery';
  end if;

  if p_delivery_status not in ('not_attempted', 'sent', 'existing_account', 'failed') then
    raise exception 'Invalid delivery status';
  end if;

  if v_category is not null then
    if length(v_category) > 64 then
      v_category := left(v_category, 64);
    end if;
    if v_category ~* '(token|secret|password|bearer|apikey|authorization)' then
      v_category := 'redacted';
    end if;
  end if;

  update public.registration_invitations
  set delivery_status = p_delivery_status,
      delivery_attempted_at = now(),
      delivery_error_category = case
        when p_delivery_status = 'failed' then v_category
        else null
      end
  where id = p_invitation_id
    and created_by = v_user_id
    and status = 'pending';

  if not found then
    raise exception 'Invitation not found or not pending';
  end if;

  insert into public.audit_events (
    household_id, actor_user_id, entity_type, entity_id, event_type, after_state
  ) values (
    null,
    v_user_id,
    'registration_invitation',
    p_invitation_id,
    'registration_invitation.delivery_attempted',
    jsonb_build_object(
      'delivery_status', p_delivery_status,
      'delivery_error_category', case when p_delivery_status = 'failed' then v_category else null end
    )
  );
end;
$$;

revoke all on function public.record_registration_invitation_delivery(uuid, text, text) from public;
grant execute on function public.record_registration_invitation_delivery(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Pending grant checks for app registration policy
-- ---------------------------------------------------------------------------
create or replace function public.has_pending_registration_invitation(p_email text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if v_email = '' or position('@' in v_email) = 0 then
    return false;
  end if;

  return exists (
    select 1
    from public.registration_invitations i
    where lower(i.invited_email) = v_email
      and i.purpose = 'create_household'
      and i.status = 'pending'
      and i.expires_at > now()
  );
end;
$$;

revoke all on function public.has_pending_registration_invitation(text) from public;
grant execute on function public.has_pending_registration_invitation(text) to anon, authenticated;

comment on function public.has_pending_registration_invitation(text) is
  'True when a pending non-expired create_household registration invitation exists for the email.';

-- ---------------------------------------------------------------------------
-- Before User Created: allow join_household OR create_household grants
-- ---------------------------------------------------------------------------
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

  if coalesce(v_allow_test, false)
     and v_test_domain is not null
     and v_email like ('%@' || lower(v_test_domain)) then
    return '{}'::jsonb;
  end if;

  if v_bootstrap is not null and v_email = lower(trim(v_bootstrap)) then
    return '{}'::jsonb;
  end if;

  -- join_household: pending household membership invitation
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

  -- create_household: pending independent registration invitation
  select exists (
    select 1
    from public.registration_invitations i
    where lower(i.invited_email) = v_email
      and i.purpose = 'create_household'
      and i.status = 'pending'
      and i.expires_at > now()
  ) into v_has_invite;

  if v_has_invite then
    return '{}'::jsonb;
  end if;

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
revoke execute on function public.hook_before_user_created(jsonb) from authenticated, anon;

comment on function public.hook_before_user_created(jsonb) is
  'Supabase Auth Before User Created hook. Allows bootstrap, test emails, pending join_household invitations, or pending create_household registration invitations.';

-- Audit household.created from independent onboarding remains household-scoped;
-- registration_invitation.consumed is written at claim time (safer single-use).
