-- Foundation schema: profiles, households, memberships, roles, invitations, settings, preferences, audit

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  avatar_path text,
  preferred_timezone text not null default 'America/Chicago',
  preferred_locale text not null default 'en-US',
  onboarding_status text not null default 'pending'
    check (onboarding_status in ('pending', 'in_progress', 'complete')),
  onboarding_draft jsonb not null default '{}'::jsonb,
  deactivated_at timestamptz,
  deactivation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_email_lower_idx on public.profiles (lower(email));

-- ---------------------------------------------------------------------------
-- Households
-- ---------------------------------------------------------------------------
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) >= 2),
  property_nickname text,
  lease_start date,
  lease_end date,
  timezone text not null default 'America/Chicago',
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (lease_end is null or lease_start is null or lease_end >= lease_start)
);

-- ---------------------------------------------------------------------------
-- Household settings
-- ---------------------------------------------------------------------------
create table public.household_settings (
  household_id uuid primary key references public.households (id) on delete cascade,
  reimbursement_policy text not null default 'external_reimbursement'
    check (reimbursement_policy in ('external_reimbursement')),
  purchase_approval_threshold_cents integer not null default 5000
    check (purchase_approval_threshold_cents >= 0),
  approval_rule text not null default 'threshold'
    check (approval_rule in ('threshold', 'always', 'never')),
  notification_defaults jsonb not null default '{}'::jsonb,
  reimbursement_policy_acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Memberships
-- ---------------------------------------------------------------------------
create table public.household_memberships (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  status text not null default 'active'
    check (status in ('invited', 'active', 'leaving', 'former', 'removed')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create index household_memberships_user_id_idx on public.household_memberships (user_id);
create index household_memberships_household_id_idx on public.household_memberships (household_id);
create index household_memberships_active_idx
  on public.household_memberships (household_id, user_id)
  where status = 'active';

-- ---------------------------------------------------------------------------
-- Membership roles (normalized responsibilities)
-- ---------------------------------------------------------------------------
create table public.household_membership_roles (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.household_memberships (id) on delete cascade,
  role text not null
    check (role in ('member', 'household_coordinator', 'financial_coordinator')),
  granted_at timestamptz not null default now(),
  granted_by uuid references public.profiles (id) on delete set null,
  unique (membership_id, role)
);

create index household_membership_roles_membership_id_idx
  on public.household_membership_roles (membership_id);

-- ---------------------------------------------------------------------------
-- Invitations
-- ---------------------------------------------------------------------------
create table public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  invited_email text not null,
  invited_by uuid not null references public.profiles (id),
  token_hash text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'revoked', 'expired')),
  intended_roles text[] not null default array['member']::text[],
  message text,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  declined_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    intended_roles <@ array['member', 'household_coordinator', 'financial_coordinator']::text[]
    and cardinality(intended_roles) >= 1
  )
);

create index household_invitations_household_id_idx on public.household_invitations (household_id);
create index household_invitations_email_idx on public.household_invitations (lower(invited_email));

-- ---------------------------------------------------------------------------
-- User preferences (current household selection)
-- ---------------------------------------------------------------------------
create table public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  current_household_id uuid references public.households (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Audit events (append-oriented)
-- ---------------------------------------------------------------------------
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households (id) on delete restrict,
  actor_user_id uuid references public.profiles (id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  event_type text not null,
  before_state jsonb,
  after_state jsonb,
  reason text,
  correlation_id uuid,
  created_at timestamptz not null default now()
);

create index audit_events_household_id_created_at_idx
  on public.audit_events (household_id, created_at desc);
create index audit_events_actor_user_id_idx on public.audit_events (actor_user_id);

-- ---------------------------------------------------------------------------
-- updated_at helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger households_set_updated_at
  before update on public.households
  for each row execute function public.set_updated_at();

create trigger household_settings_set_updated_at
  before update on public.household_settings
  for each row execute function public.set_updated_at();

create trigger household_memberships_set_updated_at
  before update on public.household_memberships
  for each row execute function public.set_updated_at();

create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Profile bootstrap from auth.users (idempotent)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(coalesce(new.email, 'user'), '@', 1)
    )
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Ensure at least one active household_coordinator remains
-- ---------------------------------------------------------------------------
create or replace function public.enforce_household_has_coordinator()
returns trigger
language plpgsql
as $$
declare
  target_household uuid;
  coordinator_count integer;
begin
  if tg_table_name = 'household_memberships' then
    target_household := coalesce(new.household_id, old.household_id);
  else
    select m.household_id into target_household
    from public.household_memberships m
    where m.id = coalesce(new.membership_id, old.membership_id);
  end if;

  if target_household is null then
    return coalesce(new, old);
  end if;

  -- Skip check while household is still being inserted (no memberships yet)
  if not exists (
    select 1 from public.household_memberships where household_id = target_household
  ) then
    return coalesce(new, old);
  end if;

  select count(*) into coordinator_count
  from public.household_memberships m
  join public.household_membership_roles r on r.membership_id = m.id
  where m.household_id = target_household
    and m.status = 'active'
    and r.role = 'household_coordinator';

  if coordinator_count < 1 then
    raise exception 'Household must retain at least one active household_coordinator';
  end if;

  return coalesce(new, old);
end;
$$;

create constraint trigger household_memberships_coordinator_required
  after insert or update or delete on public.household_memberships
  deferrable initially deferred
  for each row execute function public.enforce_household_has_coordinator();

create constraint trigger household_membership_roles_coordinator_required
  after insert or update or delete on public.household_membership_roles
  deferrable initially deferred
  for each row execute function public.enforce_household_has_coordinator();
