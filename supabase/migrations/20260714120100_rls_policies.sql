-- RLS helpers and policies

create or replace function public.is_household_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_memberships m
    where m.household_id = p_household_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.has_household_role(p_household_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_memberships m
    where m.household_id = p_household_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = any (p_roles)
  );
$$;

revoke all on function public.is_household_member(uuid) from public;
revoke all on function public.has_household_role(uuid, text[]) from public;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.has_household_role(uuid, text[]) to authenticated;

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_memberships enable row level security;
alter table public.household_invitations enable row level security;
alter table public.household_settings enable row level security;
alter table public.audit_events enable row level security;

-- profiles
create policy profiles_select_authenticated
  on public.profiles for select
  to authenticated
  using (true);

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- households
create policy households_select_member
  on public.households for select
  to authenticated
  using (public.is_household_member(id));

create policy households_insert_authenticated
  on public.households for insert
  to authenticated
  with check (created_by = auth.uid());

create policy households_update_admin
  on public.households for update
  to authenticated
  using (public.has_household_role(id, array['owner', 'admin']))
  with check (public.has_household_role(id, array['owner', 'admin']));

-- memberships
create policy memberships_select_member
  on public.household_memberships for select
  to authenticated
  using (public.is_household_member(household_id));

create policy memberships_insert_self_owner_bootstrap
  on public.household_memberships for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and role = 'owner'
    and status = 'active'
    and exists (
      select 1 from public.households h
      where h.id = household_id
        and h.created_by = auth.uid()
    )
  );

create policy memberships_update_admin
  on public.household_memberships for update
  to authenticated
  using (
    public.has_household_role(household_id, array['owner', 'admin'])
    or user_id = auth.uid()
  )
  with check (
    public.has_household_role(household_id, array['owner', 'admin'])
    or user_id = auth.uid()
  );

-- invitations
create policy invitations_select_member
  on public.household_invitations for select
  to authenticated
  using (public.is_household_member(household_id));

create policy invitations_insert_admin
  on public.household_invitations for insert
  to authenticated
  with check (public.has_household_role(household_id, array['owner', 'admin']));

create policy invitations_update_admin
  on public.household_invitations for update
  to authenticated
  using (public.has_household_role(household_id, array['owner', 'admin']))
  with check (public.has_household_role(household_id, array['owner', 'admin']));

-- settings
create policy settings_select_member
  on public.household_settings for select
  to authenticated
  using (public.is_household_member(household_id));

create policy settings_insert_creator
  on public.household_settings for insert
  to authenticated
  with check (
    exists (
      select 1 from public.households h
      where h.id = household_id
        and h.created_by = auth.uid()
    )
    or public.has_household_role(household_id, array['owner', 'admin'])
  );

create policy settings_update_admin
  on public.household_settings for update
  to authenticated
  using (public.has_household_role(household_id, array['owner', 'admin']))
  with check (public.has_household_role(household_id, array['owner', 'admin']));

-- audit_events: append-only for members
create policy audit_select_member
  on public.audit_events for select
  to authenticated
  using (
    household_id is not null
    and public.is_household_member(household_id)
  );

create policy audit_insert_member
  on public.audit_events for insert
  to authenticated
  with check (
    household_id is not null
    and public.is_household_member(household_id)
    and actor_user_id = auth.uid()
  );

-- Explicitly no update/delete policies for audit_events
