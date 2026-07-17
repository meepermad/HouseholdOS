-- Phase 9: calendar expansion RLS helpers and policies

-- ---------------------------------------------------------------------------
-- Visibility helpers
-- ---------------------------------------------------------------------------
create or replace function public.can_view_calendar(p_calendar_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_calendars c
    where c.id = p_calendar_id
      and c.is_archived = false
      and public.is_active_member(c.household_id)
      and (
        c.calendar_type = 'household'
        or c.calendar_type = 'domain'
        or c.calendar_type in ('external_readonly', 'external_writable')
        or exists (
          select 1 from public.household_calendar_memberships cm
          where cm.calendar_id = c.id
            and cm.membership_id = public.current_membership_id(c.household_id)
        )
        or (
          c.calendar_type = 'personal'
          and c.owner_membership_id = public.current_membership_id(c.household_id)
        )
      )
  );
$$;

revoke all on function public.can_view_calendar(uuid) from public;
grant execute on function public.can_view_calendar(uuid) to authenticated;

create or replace function public.can_manage_calendar(p_calendar_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_calendars c
    where c.id = p_calendar_id
      and public.is_active_member(c.household_id)
      and (
        (
          c.calendar_type = 'personal'
          and c.owner_membership_id = public.current_membership_id(c.household_id)
        )
        or (
          c.calendar_type = 'household'
          and public.has_responsibility(c.household_id, array['household_coordinator'])
        )
        or exists (
          select 1 from public.household_calendar_memberships cm
          where cm.calendar_id = c.id
            and cm.membership_id = public.current_membership_id(c.household_id)
            and cm.access_role in ('owner', 'editor')
        )
      )
  );
$$;

revoke all on function public.can_manage_calendar(uuid) from public;
grant execute on function public.can_manage_calendar(uuid) to authenticated;

create or replace function public.can_view_calendar_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.calendar_events e
    where e.id = p_event_id
      and public.is_active_member(e.household_id)
      and (
        e.organizer_membership_id = public.current_membership_id(e.household_id)
        or e.visibility = 'household'
        or e.visibility = 'private_busy'
        or exists (
          select 1 from public.calendar_event_attendees a
          where a.event_id = e.id
            and a.membership_id = public.current_membership_id(e.household_id)
        )
      )
  );
$$;

revoke all on function public.can_view_calendar_event(uuid) from public;
grant execute on function public.can_view_calendar_event(uuid) to authenticated;

create or replace function public.can_view_event_details(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.calendar_events e
    where e.id = p_event_id
      and public.is_active_member(e.household_id)
      and (
        e.organizer_membership_id = public.current_membership_id(e.household_id)
        or e.visibility = 'household'
        or exists (
          select 1 from public.calendar_event_attendees a
          where a.event_id = e.id
            and a.membership_id = public.current_membership_id(e.household_id)
        )
      )
  );
$$;

revoke all on function public.can_view_event_details(uuid) from public;
grant execute on function public.can_view_event_details(uuid) to authenticated;

create or replace function public.can_view_event_availability(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Busy/free only: any active member who can see the event shell
  select public.can_view_calendar_event(p_event_id);
$$;

revoke all on function public.can_view_event_availability(uuid) from public;
grant execute on function public.can_view_event_availability(uuid) to authenticated;

create or replace function public.can_manage_calendar_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.calendar_events e
    where e.id = p_event_id
      and e.is_editable = true
      and public.is_active_member(e.household_id)
      and (
        e.organizer_membership_id = public.current_membership_id(e.household_id)
        or (
          e.visibility = 'household'
          and public.has_responsibility(e.household_id, array['household_coordinator'])
        )
      )
  );
$$;

revoke all on function public.can_manage_calendar_event(uuid) from public;
grant execute on function public.can_manage_calendar_event(uuid) to authenticated;

create or replace function public.can_manage_external_calendar_connection(p_connection_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.calendar_external_connections c
    where c.id = p_connection_id
      and c.owner_user_id = auth.uid()
      and public.is_active_member(c.household_id)
  );
$$;

revoke all on function public.can_manage_external_calendar_connection(uuid) from public;
grant execute on function public.can_manage_external_calendar_connection(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
alter table public.household_calendars enable row level security;
alter table public.household_calendar_memberships enable row level security;
alter table public.calendar_availability_rules enable row level security;
alter table public.calendar_availability_overrides enable row level security;
alter table public.calendar_event_conflicts enable row level security;
alter table public.calendar_resources enable row level security;
alter table public.calendar_resource_reservations enable row level security;
alter table public.calendar_external_connections enable row level security;
alter table public.calendar_external_calendars enable row level security;
alter table public.calendar_external_event_mappings enable row level security;
alter table public.calendar_sync_runs enable row level security;
alter table public.calendar_sync_failures enable row level security;
alter table public.calendar_event_links enable row level security;
alter table public.calendar_ics_import_uids enable row level security;

-- household_calendars
create policy household_calendars_select on public.household_calendars
  for select to authenticated
  using (public.can_view_calendar(id) or public.is_active_member(household_id));

create policy household_calendars_no_direct_write on public.household_calendars
  for all to authenticated
  using (false)
  with check (false);

-- calendar memberships
create policy household_calendar_memberships_select on public.household_calendar_memberships
  for select to authenticated
  using (public.is_active_member(household_id));

create policy household_calendar_memberships_no_direct_write on public.household_calendar_memberships
  for all to authenticated
  using (false)
  with check (false);

-- availability: own rules readable by active members as busy windows only via RPC;
-- direct select limited to owner or same-household for coordination
create policy calendar_availability_rules_select on public.calendar_availability_rules
  for select to authenticated
  using (
    public.is_active_member(household_id)
    and (
      membership_id = public.current_membership_id(household_id)
      or public.has_responsibility(household_id, array['household_coordinator'])
    )
  );

create policy calendar_availability_rules_no_direct_write on public.calendar_availability_rules
  for all to authenticated
  using (false)
  with check (false);

create policy calendar_availability_overrides_select on public.calendar_availability_overrides
  for select to authenticated
  using (
    public.is_active_member(household_id)
    and (
      membership_id = public.current_membership_id(household_id)
      or override_kind <> 'private_block'
    )
  );

create policy calendar_availability_overrides_no_direct_write on public.calendar_availability_overrides
  for all to authenticated
  using (false)
  with check (false);

-- conflicts
create policy calendar_event_conflicts_select on public.calendar_event_conflicts
  for select to authenticated
  using (
    public.is_active_member(household_id)
    and public.can_view_calendar_event(event_id)
  );

create policy calendar_event_conflicts_no_direct_write on public.calendar_event_conflicts
  for all to authenticated
  using (false)
  with check (false);

-- resources
create policy calendar_resources_select on public.calendar_resources
  for select to authenticated
  using (public.is_active_member(household_id) and is_active = true);

create policy calendar_resources_no_direct_write on public.calendar_resources
  for all to authenticated
  using (false)
  with check (false);

create policy calendar_resource_reservations_select on public.calendar_resource_reservations
  for select to authenticated
  using (
    public.is_active_member(household_id)
    and public.can_view_calendar_event(event_id)
  );

create policy calendar_resource_reservations_no_direct_write on public.calendar_resource_reservations
  for all to authenticated
  using (false)
  with check (false);

-- external connections: owner only (never expose ciphertext via select of other users)
create policy calendar_external_connections_select on public.calendar_external_connections
  for select to authenticated
  using (
    owner_user_id = auth.uid()
    and public.is_active_member(household_id)
  );

create policy calendar_external_connections_no_direct_write on public.calendar_external_connections
  for all to authenticated
  using (false)
  with check (false);

create policy calendar_external_calendars_select on public.calendar_external_calendars
  for select to authenticated
  using (
    exists (
      select 1 from public.calendar_external_connections c
      where c.id = connection_id
        and c.owner_user_id = auth.uid()
        and public.is_active_member(c.household_id)
    )
  );

create policy calendar_external_calendars_no_direct_write on public.calendar_external_calendars
  for all to authenticated
  using (false)
  with check (false);

create policy calendar_external_event_mappings_select on public.calendar_external_event_mappings
  for select to authenticated
  using (
    exists (
      select 1 from public.calendar_external_connections c
      where c.id = connection_id
        and c.owner_user_id = auth.uid()
    )
  );

create policy calendar_external_event_mappings_no_direct_write on public.calendar_external_event_mappings
  for all to authenticated
  using (false)
  with check (false);

create policy calendar_sync_runs_select on public.calendar_sync_runs
  for select to authenticated
  using (
    exists (
      select 1 from public.calendar_external_connections c
      where c.id = connection_id
        and c.owner_user_id = auth.uid()
    )
  );

create policy calendar_sync_runs_no_direct_write on public.calendar_sync_runs
  for all to authenticated
  using (false)
  with check (false);

create policy calendar_sync_failures_select on public.calendar_sync_failures
  for select to authenticated
  using (
    exists (
      select 1 from public.calendar_external_connections c
      where c.id = connection_id
        and c.owner_user_id = auth.uid()
    )
  );

create policy calendar_sync_failures_no_direct_write on public.calendar_sync_failures
  for all to authenticated
  using (false)
  with check (false);

create policy calendar_event_links_select on public.calendar_event_links
  for select to authenticated
  using (
    public.is_active_member(household_id)
    and public.can_view_event_details(event_id)
  );

create policy calendar_event_links_no_direct_write on public.calendar_event_links
  for all to authenticated
  using (false)
  with check (false);

create policy calendar_ics_import_uids_select on public.calendar_ics_import_uids
  for select to authenticated
  using (public.is_active_member(household_id));

create policy calendar_ics_import_uids_no_direct_write on public.calendar_ics_import_uids
  for all to authenticated
  using (false)
  with check (false);

-- Storage policies for calendar-attachments
create policy calendar_attachments_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'calendar-attachments'
    and public.is_active_member((storage.foldername(name))[1]::uuid)
  );

create policy calendar_attachments_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'calendar-attachments'
    and public.is_active_member((storage.foldername(name))[1]::uuid)
  );
