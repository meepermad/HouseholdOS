-- Phase 5: chore and responsibility row-level security

alter table public.chore_rotations enable row level security;
alter table public.chore_rotation_members enable row level security;
alter table public.chore_definitions enable row level security;
alter table public.chore_occurrences enable row level security;
alter table public.chore_assignments enable row level security;
alter table public.chore_completion_records enable row level security;
alter table public.chore_reassignment_requests enable row level security;
alter table public.responsibility_areas enable row level security;
alter table public.responsibility_assignments enable row level security;
alter table public.responsibility_transfers enable row level security;

create or replace function public._chore_active_membership(p_household_id uuid)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select m.id into v_id from public.household_memberships m
  where m.household_id=p_household_id and m.user_id=auth.uid() and m.status='active';
  if v_id is null then raise exception 'Active membership required for this household'; end if;
  return v_id;
end $$;
revoke all on function public._chore_active_membership(uuid) from public, anon;

create or replace function public.is_household_coordinator(p_household_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_memberships m
    join public.household_membership_roles r on r.membership_id=m.id
    where m.household_id=p_household_id and m.user_id=auth.uid()
      and m.status='active' and r.role='household_coordinator'
  )
$$;
revoke all on function public.is_household_coordinator(uuid) from public, anon;
grant execute on function public.is_household_coordinator(uuid) to authenticated;

create or replace function public.is_chore_assignee(p_occurrence_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.chore_assignments a
    join public.household_memberships m on m.id=a.membership_id
    where a.occurrence_id=p_occurrence_id and m.user_id=auth.uid()
      and m.status='active' and a.status <> 'released'
  )
$$;
revoke all on function public.is_chore_assignee(uuid) from public, anon;
grant execute on function public.is_chore_assignee(uuid) to authenticated;

create or replace function public.can_view_chore_definition(p_definition_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.chore_definitions d
    where d.id=p_definition_id and public.is_active_member(d.household_id)
      and (
        d.visibility='household'
        or d.created_by_membership_id=public.current_membership_id(d.household_id)
        or public.is_household_coordinator(d.household_id)
        or exists (
          select 1 from public.chore_occurrences o
          join public.chore_assignments a on a.occurrence_id=o.id
          where o.definition_id=d.id
            and a.membership_id=public.current_membership_id(d.household_id)
            and a.status <> 'released'
        )
      )
  )
$$;
revoke all on function public.can_view_chore_definition(uuid) from public, anon;
grant execute on function public.can_view_chore_definition(uuid) to authenticated;

create or replace function public.can_view_chore_occurrence(p_occurrence_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.chore_occurrences o
    join public.chore_definitions d on d.id=o.definition_id
    where o.id=p_occurrence_id and public.is_active_member(o.household_id)
      and (d.visibility='household' or d.created_by_membership_id=public.current_membership_id(o.household_id)
        or public.is_household_coordinator(o.household_id) or public.is_chore_assignee(o.id))
  )
$$;
revoke all on function public.can_view_chore_occurrence(uuid) from public, anon;
grant execute on function public.can_view_chore_occurrence(uuid) to authenticated;

create policy chore_rotations_select on public.chore_rotations for select to authenticated using (public.is_active_member(household_id));
create policy chore_rotation_members_select on public.chore_rotation_members for select to authenticated using (public.is_active_member(household_id));
create policy chore_definitions_select on public.chore_definitions for select to authenticated using (public.can_view_chore_definition(id));
create policy chore_occurrences_select on public.chore_occurrences for select to authenticated using (public.can_view_chore_occurrence(id));
create policy chore_assignments_select on public.chore_assignments for select to authenticated using (public.can_view_chore_occurrence(occurrence_id));
create policy chore_completion_records_select on public.chore_completion_records for select to authenticated using (public.can_view_chore_occurrence(occurrence_id));
create policy chore_reassignment_requests_select on public.chore_reassignment_requests for select to authenticated using (public.can_view_chore_occurrence(occurrence_id));
create policy responsibility_areas_select on public.responsibility_areas for select to authenticated using (public.is_active_member(household_id));
create policy responsibility_assignments_select on public.responsibility_assignments for select to authenticated using (public.is_active_member(household_id));
create policy responsibility_transfers_select on public.responsibility_transfers for select to authenticated using (
  public.is_active_member(household_id)
  and (from_membership_id=public.current_membership_id(household_id)
    or to_membership_id=public.current_membership_id(household_id)
    or public.is_household_coordinator(household_id))
);

revoke all on table public.chore_rotations, public.chore_rotation_members, public.chore_definitions,
  public.chore_occurrences, public.chore_assignments, public.chore_completion_records,
  public.chore_reassignment_requests, public.responsibility_areas, public.responsibility_assignments,
  public.responsibility_transfers from public, anon, authenticated;
grant select on table public.chore_rotations, public.chore_rotation_members, public.chore_definitions,
  public.chore_occurrences, public.chore_assignments, public.chore_completion_records,
  public.chore_reassignment_requests, public.responsibility_areas, public.responsibility_assignments,
  public.responsibility_transfers to authenticated;
grant all on table public.chore_rotations, public.chore_rotation_members, public.chore_definitions,
  public.chore_occurrences, public.chore_assignments, public.chore_completion_records,
  public.chore_reassignment_requests, public.responsibility_areas, public.responsibility_assignments,
  public.responsibility_transfers to service_role;
