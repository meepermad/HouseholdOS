-- Phase 7B: maintenance RLS + visibility helpers

create or replace function public._maintenance_active_membership(p_household_id uuid)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare v_id uuid;
begin
  select m.id into v_id from public.household_memberships m
  where m.household_id = p_household_id and m.user_id = auth.uid() and m.status = 'active';
  if v_id is null then raise exception 'Not an active household member'; end if;
  return v_id;
end $$;
revoke all on function public._maintenance_active_membership(uuid) from public, anon;

-- Reuse existing public.is_household_coordinator(uuid) from chores (role column).

create or replace function public.can_view_maintenance_request(p_request_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.maintenance_requests r
    where r.id = p_request_id
      and public.is_active_member(r.household_id)
      and (
        r.visibility = 'household'
        or r.reporter_membership_id = public.current_membership_id(r.household_id)
        or r.primary_coordinator_membership_id = public.current_membership_id(r.household_id)
        or exists (
          select 1 from public.maintenance_request_participants p
          where p.request_id = r.id
            and p.membership_id = public.current_membership_id(r.household_id)
        )
        or exists (
          select 1 from public.maintenance_assignments a
          where a.request_id = r.id and a.unassigned_at is null
            and a.membership_id = public.current_membership_id(r.household_id)
        )
        or (
          r.visibility = 'coordinators'
          and public.is_household_coordinator(r.household_id)
        )
        or (
          r.visibility = 'participants'
          and (
            r.reporter_membership_id = public.current_membership_id(r.household_id)
            or exists (
              select 1 from public.maintenance_request_participants p
              where p.request_id = r.id
                and p.membership_id = public.current_membership_id(r.household_id)
            )
            or exists (
              select 1 from public.maintenance_assignments a
              where a.request_id = r.id and a.unassigned_at is null
                and a.membership_id = public.current_membership_id(r.household_id)
            )
            or public.is_household_coordinator(r.household_id)
          )
        )
      )
  );
$$;
revoke all on function public.can_view_maintenance_request(uuid) from public, anon;
grant execute on function public.can_view_maintenance_request(uuid) to authenticated;

alter table public.maintenance_external_contacts enable row level security;
alter table public.maintenance_requests enable row level security;
alter table public.maintenance_request_participants enable row level security;
alter table public.maintenance_assignments enable row level security;
alter table public.maintenance_events enable row level security;
alter table public.maintenance_actions enable row level security;
alter table public.maintenance_chore_links enable row level security;
alter table public.maintenance_calendar_links enable row level security;
alter table public.maintenance_expense_links enable row level security;
alter table public.maintenance_inventory_links enable row level security;
alter table public.maintenance_contact_events enable row level security;
alter table public.maintenance_quotes enable row level security;
alter table public.maintenance_warranty_claims enable row level security;
alter table public.maintenance_attachments enable row level security;

create policy maintenance_contacts_select on public.maintenance_external_contacts
  for select to authenticated using (public.is_active_member(household_id));

create policy maintenance_requests_select on public.maintenance_requests
  for select to authenticated using (public.can_view_maintenance_request(id));

create policy maintenance_participants_select on public.maintenance_request_participants
  for select to authenticated using (public.can_view_maintenance_request(request_id));

create policy maintenance_assignments_select on public.maintenance_assignments
  for select to authenticated using (public.can_view_maintenance_request(request_id));

create policy maintenance_events_select on public.maintenance_events
  for select to authenticated using (public.can_view_maintenance_request(request_id));

create policy maintenance_actions_select on public.maintenance_actions
  for select to authenticated using (public.can_view_maintenance_request(request_id));

create policy maintenance_chore_links_select on public.maintenance_chore_links
  for select to authenticated using (public.can_view_maintenance_request(request_id));

create policy maintenance_calendar_links_select on public.maintenance_calendar_links
  for select to authenticated using (public.can_view_maintenance_request(request_id));

create policy maintenance_expense_links_select on public.maintenance_expense_links
  for select to authenticated using (public.can_view_maintenance_request(request_id));

create policy maintenance_inventory_links_select on public.maintenance_inventory_links
  for select to authenticated using (public.can_view_maintenance_request(request_id));

create policy maintenance_contact_events_select on public.maintenance_contact_events
  for select to authenticated using (public.can_view_maintenance_request(request_id));

create policy maintenance_quotes_select on public.maintenance_quotes
  for select to authenticated using (public.can_view_maintenance_request(request_id));

create policy maintenance_warranty_select on public.maintenance_warranty_claims
  for select to authenticated using (public.can_view_maintenance_request(request_id));

-- Attachments: viewers of request; storage path not exposed beyond authorized viewers
create policy maintenance_attachments_select on public.maintenance_attachments
  for select to authenticated using (
    deleted_at is null and public.can_view_maintenance_request(request_id)
  );

revoke all on table public.maintenance_external_contacts from public;
revoke all on table public.maintenance_requests from public;
revoke all on table public.maintenance_request_participants from public;
revoke all on table public.maintenance_assignments from public;
revoke all on table public.maintenance_events from public;
revoke all on table public.maintenance_actions from public;
revoke all on table public.maintenance_chore_links from public;
revoke all on table public.maintenance_calendar_links from public;
revoke all on table public.maintenance_expense_links from public;
revoke all on table public.maintenance_inventory_links from public;
revoke all on table public.maintenance_contact_events from public;
revoke all on table public.maintenance_quotes from public;
revoke all on table public.maintenance_warranty_claims from public;
revoke all on table public.maintenance_attachments from public;

grant select on table public.maintenance_external_contacts to authenticated;
grant select on table public.maintenance_requests to authenticated;
grant select on table public.maintenance_request_participants to authenticated;
grant select on table public.maintenance_assignments to authenticated;
grant select on table public.maintenance_events to authenticated;
grant select on table public.maintenance_actions to authenticated;
grant select on table public.maintenance_chore_links to authenticated;
grant select on table public.maintenance_calendar_links to authenticated;
grant select on table public.maintenance_expense_links to authenticated;
grant select on table public.maintenance_inventory_links to authenticated;
grant select on table public.maintenance_contact_events to authenticated;
grant select on table public.maintenance_quotes to authenticated;
grant select on table public.maintenance_warranty_claims to authenticated;
grant select on table public.maintenance_attachments to authenticated;

grant all on table public.maintenance_external_contacts to service_role;
grant all on table public.maintenance_requests to service_role;
grant all on table public.maintenance_request_participants to service_role;
grant all on table public.maintenance_assignments to service_role;
grant all on table public.maintenance_events to service_role;
grant all on table public.maintenance_actions to service_role;
grant all on table public.maintenance_chore_links to service_role;
grant all on table public.maintenance_calendar_links to service_role;
grant all on table public.maintenance_expense_links to service_role;
grant all on table public.maintenance_inventory_links to service_role;
grant all on table public.maintenance_contact_events to service_role;
grant all on table public.maintenance_quotes to service_role;
grant all on table public.maintenance_warranty_claims to service_role;
grant all on table public.maintenance_attachments to service_role;
