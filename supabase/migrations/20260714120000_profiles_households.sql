-- Phase 0 foundation: profiles, households, memberships, invitations, settings, audit

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) >= 2),
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.household_memberships (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  role text not null check (role in ('owner', 'admin', 'member')),
  status text not null default 'active' check (status in ('active', 'left', 'removed')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique (household_id, user_id)
);

create index household_memberships_user_id_idx on public.household_memberships (user_id);
create index household_memberships_household_id_idx on public.household_memberships (household_id);

create table public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'member')),
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid not null references public.profiles (id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index household_invitations_household_id_idx on public.household_invitations (household_id);
create index household_invitations_email_idx on public.household_invitations (lower(email));

create table public.household_settings (
  household_id uuid primary key references public.households (id) on delete cascade,
  timezone text not null default 'America/Chicago',
  currency text not null default 'USD' check (currency = 'USD'),
  display_name text not null,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households (id) on delete restrict,
  actor_user_id uuid references public.profiles (id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index audit_events_household_id_created_at_idx
  on public.audit_events (household_id, created_at desc);

-- Profile bootstrap from auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

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

create or replace function public.household_settings_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger household_settings_set_updated_at
  before update on public.household_settings
  for each row execute function public.household_settings_set_updated_at();

-- Ensure at least one active owner remains
create or replace function public.enforce_household_has_owner()
returns trigger
language plpgsql
as $$
declare
  owner_count integer;
  target_household uuid;
begin
  target_household := coalesce(new.household_id, old.household_id);

  select count(*) into owner_count
  from public.household_memberships
  where household_id = target_household
    and role = 'owner'
    and status = 'active';

  if owner_count < 1 then
    raise exception 'Household must retain at least one active owner';
  end if;

  return coalesce(new, old);
end;
$$;

create constraint trigger household_memberships_owner_required
  after insert or update or delete on public.household_memberships
  deferrable initially deferred
  for each row execute function public.enforce_household_has_owner();
