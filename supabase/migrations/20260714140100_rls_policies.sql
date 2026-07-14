-- RLS helpers and policies

create or replace function public.is_active_member(p_household_id uuid)
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

create or replace function public.has_responsibility(p_household_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_memberships m
    join public.household_membership_roles r on r.membership_id = m.id
    where m.household_id = p_household_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and r.role = any (p_roles)
  );
$$;

revoke all on function public.is_active_member(uuid) from public;
revoke all on function public.has_responsibility(uuid, text[]) from public;
grant execute on function public.is_active_member(uuid) to authenticated;
grant execute on function public.has_responsibility(uuid, text[]) to authenticated;

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_settings enable row level security;
alter table public.household_memberships enable row level security;
alter table public.household_membership_roles enable row level security;
alter table public.household_invitations enable row level security;
alter table public.user_preferences enable row level security;
alter table public.audit_events enable row level security;

-- profiles: read household co-members + self; update self only
create policy profiles_select_self_or_comember
  on public.profiles for select
  to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.household_memberships mine
      join public.household_memberships theirs
        on theirs.household_id = mine.household_id
       and theirs.status = 'active'
      where mine.user_id = auth.uid()
        and mine.status = 'active'
        and theirs.user_id = profiles.id
    )
  );

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_insert_own
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

-- households
create policy households_select_member
  on public.households for select
  to authenticated
  using (public.is_active_member(id));

create policy households_insert_authenticated
  on public.households for insert
  to authenticated
  with check (created_by = auth.uid());

create policy households_update_coordinator
  on public.households for update
  to authenticated
  using (public.has_responsibility(id, array['household_coordinator']))
  with check (public.has_responsibility(id, array['household_coordinator']));

-- household_settings
create policy settings_select_member
  on public.household_settings for select
  to authenticated
  using (public.is_active_member(household_id));

create policy settings_insert_creator
  on public.household_settings for insert
  to authenticated
  with check (
    exists (
      select 1 from public.households h
      where h.id = household_id
        and h.created_by = auth.uid()
    )
    or public.has_responsibility(household_id, array['household_coordinator', 'financial_coordinator'])
  );

create policy settings_update_coordinator
  on public.household_settings for update
  to authenticated
  using (
    public.has_responsibility(
      household_id,
      array['household_coordinator', 'financial_coordinator']
    )
  )
  with check (
    public.has_responsibility(
      household_id,
      array['household_coordinator', 'financial_coordinator']
    )
  );

-- memberships
create policy memberships_select_member
  on public.household_memberships for select
  to authenticated
  using (
    public.is_active_member(household_id)
    or user_id = auth.uid()
  );

create policy memberships_insert_self_bootstrap
  on public.household_memberships for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and status = 'active'
    and exists (
      select 1 from public.households h
      where h.id = household_id
        and h.created_by = auth.uid()
    )
  );

-- Role changes and status updates go through security definer RPCs.
-- Direct updates allowed for self-leave and coordinator-managed paths via RPC only
-- (no broad update policy that enables self-promotion).
create policy memberships_update_self_or_coordinator
  on public.household_memberships for update
  to authenticated
  using (
    user_id = auth.uid()
    or public.has_responsibility(household_id, array['household_coordinator'])
  )
  with check (
    user_id = auth.uid()
    or public.has_responsibility(household_id, array['household_coordinator'])
  );

-- membership roles: select for members; mutations via RPC (security definer)
create policy membership_roles_select_member
  on public.household_membership_roles for select
  to authenticated
  using (
    exists (
      select 1
      from public.household_memberships m
      where m.id = membership_id
        and (
          public.is_active_member(m.household_id)
          or m.user_id = auth.uid()
        )
    )
  );

create policy membership_roles_insert_bootstrap
  on public.household_membership_roles for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.household_memberships m
      join public.households h on h.id = m.household_id
      where m.id = membership_id
        and m.user_id = auth.uid()
        and h.created_by = auth.uid()
    )
  );

-- invitations
create policy invitations_select_coordinator
  on public.household_invitations for select
  to authenticated
  using (
    public.has_responsibility(household_id, array['household_coordinator'])
    or (
      lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and status = 'pending'
    )
  );

create policy invitations_insert_coordinator
  on public.household_invitations for insert
  to authenticated
  with check (public.has_responsibility(household_id, array['household_coordinator']));

create policy invitations_update_coordinator
  on public.household_invitations for update
  to authenticated
  using (public.has_responsibility(household_id, array['household_coordinator']))
  with check (public.has_responsibility(household_id, array['household_coordinator']));

-- user_preferences
create policy user_preferences_select_own
  on public.user_preferences for select
  to authenticated
  using (user_id = auth.uid());

create policy user_preferences_insert_own
  on public.user_preferences for insert
  to authenticated
  with check (user_id = auth.uid());

create policy user_preferences_update_own
  on public.user_preferences for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- audit_events: append-only for active members
create policy audit_select_member
  on public.audit_events for select
  to authenticated
  using (
    household_id is not null
    and public.is_active_member(household_id)
  );

create policy audit_insert_member
  on public.audit_events for insert
  to authenticated
  with check (
    actor_user_id = auth.uid()
    and (
      household_id is null
      or public.is_active_member(household_id)
    )
  );

-- Explicitly no update/delete policies for audit_events
