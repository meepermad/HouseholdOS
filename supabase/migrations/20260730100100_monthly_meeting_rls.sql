-- Meeting-Money-B RLS: active members can read; writes go through RPCs where possible.

alter table public.household_meetings enable row level security;
alter table public.household_meeting_participants enable row level security;
alter table public.household_meeting_sections enable row level security;
alter table public.household_meeting_agenda_items enable row level security;
alter table public.household_meeting_packet_versions enable row level security;
alter table public.household_meeting_snapshots enable row level security;
alter table public.household_meeting_snapshot_values enable row level security;
alter table public.household_meeting_session_notes enable row level security;
alter table public.household_meeting_decisions enable row level security;
alter table public.household_meeting_action_items enable row level security;
alter table public.household_meeting_record_links enable row level security;
alter table public.household_meeting_preferences enable row level security;

create policy household_meetings_select on public.household_meetings
  for select to authenticated
  using (public.is_active_member(household_id));

create policy household_meetings_no_direct_write on public.household_meetings
  for all to authenticated
  using (false)
  with check (false);

create policy household_meeting_participants_select on public.household_meeting_participants
  for select to authenticated
  using (public.is_active_member(household_id));

create policy household_meeting_participants_no_direct_write on public.household_meeting_participants
  for all to authenticated
  using (false)
  with check (false);

create policy household_meeting_sections_select on public.household_meeting_sections
  for select to authenticated
  using (public.is_active_member(household_id));

create policy household_meeting_sections_no_direct_write on public.household_meeting_sections
  for all to authenticated
  using (false)
  with check (false);

create policy household_meeting_agenda_items_select on public.household_meeting_agenda_items
  for select to authenticated
  using (public.is_active_member(household_id));

create policy household_meeting_agenda_items_no_direct_write on public.household_meeting_agenda_items
  for all to authenticated
  using (false)
  with check (false);

create policy household_meeting_packet_versions_select on public.household_meeting_packet_versions
  for select to authenticated
  using (public.is_active_member(household_id));

create policy household_meeting_packet_versions_no_direct_write on public.household_meeting_packet_versions
  for all to authenticated
  using (false)
  with check (false);

-- Shared snapshots: any active member. Personal: only that membership.
create policy household_meeting_snapshots_select on public.household_meeting_snapshots
  for select to authenticated
  using (
    public.is_active_member(household_id)
    and (
      projection = 'shared'
      or membership_id = public.current_membership_id(household_id)
    )
  );

create policy household_meeting_snapshots_no_direct_write on public.household_meeting_snapshots
  for all to authenticated
  using (false)
  with check (false);

create policy household_meeting_snapshot_values_select on public.household_meeting_snapshot_values
  for select to authenticated
  using (
    exists (
      select 1 from public.household_meeting_snapshots s
      where s.id = snapshot_id
        and public.is_active_member(s.household_id)
        and (
          s.projection = 'shared'
          or s.membership_id = public.current_membership_id(s.household_id)
        )
    )
  );

create policy household_meeting_snapshot_values_no_direct_write on public.household_meeting_snapshot_values
  for all to authenticated
  using (false)
  with check (false);

create policy household_meeting_session_notes_select on public.household_meeting_session_notes
  for select to authenticated
  using (public.is_active_member(household_id));

create policy household_meeting_session_notes_no_direct_write on public.household_meeting_session_notes
  for all to authenticated
  using (false)
  with check (false);

create policy household_meeting_decisions_select on public.household_meeting_decisions
  for select to authenticated
  using (public.is_active_member(household_id));

create policy household_meeting_decisions_no_direct_write on public.household_meeting_decisions
  for all to authenticated
  using (false)
  with check (false);

create policy household_meeting_action_items_select on public.household_meeting_action_items
  for select to authenticated
  using (public.is_active_member(household_id));

create policy household_meeting_action_items_no_direct_write on public.household_meeting_action_items
  for all to authenticated
  using (false)
  with check (false);

create policy household_meeting_record_links_select on public.household_meeting_record_links
  for select to authenticated
  using (public.is_active_member(household_id));

create policy household_meeting_record_links_no_direct_write on public.household_meeting_record_links
  for all to authenticated
  using (false)
  with check (false);

create policy household_meeting_preferences_select on public.household_meeting_preferences
  for select to authenticated
  using (public.is_active_member(household_id));

create policy household_meeting_preferences_no_direct_write on public.household_meeting_preferences
  for all to authenticated
  using (false)
  with check (false);

grant select on public.household_meetings to authenticated;
grant select on public.household_meeting_participants to authenticated;
grant select on public.household_meeting_sections to authenticated;
grant select on public.household_meeting_agenda_items to authenticated;
grant select on public.household_meeting_packet_versions to authenticated;
grant select on public.household_meeting_snapshots to authenticated;
grant select on public.household_meeting_snapshot_values to authenticated;
grant select on public.household_meeting_session_notes to authenticated;
grant select on public.household_meeting_decisions to authenticated;
grant select on public.household_meeting_action_items to authenticated;
grant select on public.household_meeting_record_links to authenticated;
grant select on public.household_meeting_preferences to authenticated;
