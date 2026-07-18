-- Meeting-Money-B RPCs (actor from auth.uid(), fixed search_path, revoke public)

create or replace function public._meeting_default_sections()
returns table (section_key text, title text, sort_order integer, informational_only boolean)
language sql
immutable
as $$
  select * from (values
    ('opening', 'Opening and attendance', 1, true),
    ('follow_up', 'Follow-up from last meeting', 2, false),
    ('decisions', 'Decisions needed', 3, false),
    ('money', 'Money', 4, true),
    ('chores', 'Chores and responsibilities', 5, false),
    ('calendar', 'Calendar, guests, and availability', 6, false),
    ('food', 'Food, shopping, pantry, and supplies', 7, false),
    ('maintenance', 'Maintenance and household condition', 8, false),
    ('purchases', 'Purchases, inventory, and borrowed items', 9, false),
    ('utilities', 'Utilities and recurring obligations', 10, false),
    ('governance', 'Governance and policies', 11, false),
    ('packages_parking', 'Packages and parking', 12, false),
    ('upcoming', 'Upcoming month', 13, true),
    ('new_actions', 'New action items', 14, false),
    ('summary', 'Summary and next meeting', 15, true)
  ) as t(section_key, title, sort_order, informational_only);
$$;

revoke all on function public._meeting_default_sections() from public;

create or replace function public.ensure_monthly_meeting(
  p_household_id uuid,
  p_period_start date,
  p_period_end date,
  p_meeting_at timestamptz default null,
  p_timezone text default 'America/Chicago',
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_id uuid;
  v_sec record;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_active_member(p_household_id) then
    raise exception 'Not an active household member';
  end if;
  v_actor := public.current_membership_id(p_household_id);
  if p_period_end < p_period_start then
    raise exception 'Invalid review period';
  end if;

  if p_idempotency_key is not null then
    select id into v_id from public.household_meetings
    where client_idempotency_key = p_idempotency_key;
    if found then return v_id; end if;
  end if;

  insert into public.household_meetings (
    household_id, status, period_start, period_end, meeting_at, timezone,
    organizer_membership_id, client_idempotency_key
  ) values (
    p_household_id, 'draft', p_period_start, p_period_end, p_meeting_at, coalesce(p_timezone, 'America/Chicago'),
    v_actor, p_idempotency_key
  ) returning id into v_id;

  insert into public.household_meeting_participants (
    meeting_id, household_id, membership_id, role
  )
  select v_id, p_household_id, m.id,
    case when m.id = v_actor then 'organizer' else 'participant' end
  from public.household_memberships m
  where m.household_id = p_household_id and m.status = 'active';

  for v_sec in select * from public._meeting_default_sections() loop
    insert into public.household_meeting_sections (
      meeting_id, household_id, section_key, title, sort_order, informational_only
    ) values (
      v_id, p_household_id, v_sec.section_key, v_sec.title, v_sec.sort_order, v_sec.informational_only
    );
  end loop;

  insert into public.household_meeting_preferences (household_id)
  values (p_household_id)
  on conflict (household_id) do nothing;

  return v_id;
end;
$$;

revoke all on function public.ensure_monthly_meeting(uuid, date, date, timestamptz, text, text) from public;
grant execute on function public.ensure_monthly_meeting(uuid, date, date, timestamptz, text, text) to authenticated;

create or replace function public.lock_meeting_packet(
  p_meeting_id uuid,
  p_shared_payload jsonb,
  p_source_freshness jsonb default '{}'::jsonb,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.household_meetings%rowtype;
  v_actor uuid;
  v_version_id uuid;
  v_snapshot_id uuid;
  v_next_version integer;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_row from public.household_meetings where id = p_meeting_id for update;
  if not found then raise exception 'Meeting not found'; end if;
  if not public.is_active_member(v_row.household_id) then
    raise exception 'Not an active household member';
  end if;
  v_actor := public.current_membership_id(v_row.household_id);
  if v_row.organizer_membership_id <> v_actor and not public.is_household_coordinator(v_row.household_id) then
    raise exception 'Only the organizer can lock the packet';
  end if;
  if v_row.status not in ('draft', 'preparing', 'ready_for_review') then
    raise exception 'Meeting cannot be locked from status %', v_row.status;
  end if;

  v_next_version := v_row.packet_version;
  if v_row.locked_at is not null then
    v_next_version := v_row.packet_version + 1;
  end if;

  insert into public.household_meeting_packet_versions (
    meeting_id, household_id, version, kind, created_by_membership_id
  ) values (
    v_row.id, v_row.household_id, v_next_version, 'locked', v_actor
  ) returning id into v_version_id;

  insert into public.household_meeting_snapshots (
    meeting_id, household_id, packet_version_id, projection, payload, source_freshness
  ) values (
    v_row.id, v_row.household_id, v_version_id, 'shared', coalesce(p_shared_payload, '{}'::jsonb),
    coalesce(p_source_freshness, '{}'::jsonb)
  ) returning id into v_snapshot_id;

  update public.household_meetings
  set status = 'locked',
      packet_version = v_next_version,
      locked_at = now(),
      data_snapshot_at = now(),
      updated_at = now()
  where id = v_row.id;

  return v_version_id;
end;
$$;

revoke all on function public.lock_meeting_packet(uuid, jsonb, jsonb, text) from public;
grant execute on function public.lock_meeting_packet(uuid, jsonb, jsonb, text) to authenticated;

create or replace function public.save_personal_meeting_addendum(
  p_meeting_id uuid,
  p_packet_version_id uuid,
  p_payload jsonb,
  p_source_freshness jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.household_meetings%rowtype;
  v_actor uuid;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_row from public.household_meetings where id = p_meeting_id;
  if not found then raise exception 'Meeting not found'; end if;
  if not public.is_active_member(v_row.household_id) then
    raise exception 'Not an active household member';
  end if;
  v_actor := public.current_membership_id(v_row.household_id);

  delete from public.household_meeting_snapshots
  where packet_version_id = p_packet_version_id
    and projection = 'personal'
    and membership_id = v_actor;

  insert into public.household_meeting_snapshots (
    meeting_id, household_id, packet_version_id, projection, membership_id, payload, source_freshness
  ) values (
    v_row.id, v_row.household_id, p_packet_version_id, 'personal', v_actor,
    coalesce(p_payload, '{}'::jsonb), coalesce(p_source_freshness, '{}'::jsonb)
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.save_personal_meeting_addendum(uuid, uuid, jsonb, jsonb) from public;
grant execute on function public.save_personal_meeting_addendum(uuid, uuid, jsonb, jsonb) to authenticated;

create or replace function public.start_meeting(p_meeting_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.household_meetings%rowtype;
  v_actor uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_row from public.household_meetings where id = p_meeting_id for update;
  if not found then raise exception 'Meeting not found'; end if;
  if not public.is_active_member(v_row.household_id) then
    raise exception 'Not an active household member';
  end if;
  v_actor := public.current_membership_id(v_row.household_id);
  if v_row.organizer_membership_id <> v_actor and not public.is_household_coordinator(v_row.household_id) then
    raise exception 'Only the organizer can start the meeting';
  end if;
  if v_row.status <> 'locked' then
    raise exception 'Meeting must be locked before starting';
  end if;
  update public.household_meetings
  set status = 'in_progress', started_at = now(), updated_at = now()
  where id = v_row.id;
end;
$$;

revoke all on function public.start_meeting(uuid) from public;
grant execute on function public.start_meeting(uuid) to authenticated;

create or replace function public.complete_meeting(p_meeting_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.household_meetings%rowtype;
  v_actor uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_row from public.household_meetings where id = p_meeting_id for update;
  if not found then raise exception 'Meeting not found'; end if;
  if not public.is_active_member(v_row.household_id) then
    raise exception 'Not an active household member';
  end if;
  v_actor := public.current_membership_id(v_row.household_id);
  if v_row.organizer_membership_id <> v_actor and not public.is_household_coordinator(v_row.household_id) then
    raise exception 'Only the organizer can complete the meeting';
  end if;
  if v_row.status <> 'in_progress' then
    raise exception 'Meeting must be in progress to complete';
  end if;
  update public.household_meetings
  set status = 'completed', completed_at = now(), updated_at = now()
  where id = v_row.id;
end;
$$;

revoke all on function public.complete_meeting(uuid) from public;
grant execute on function public.complete_meeting(uuid) to authenticated;

create or replace function public.publish_meeting_recap(
  p_meeting_id uuid,
  p_recap_payload jsonb,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.household_meetings%rowtype;
  v_actor uuid;
  v_version_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_row from public.household_meetings where id = p_meeting_id for update;
  if not found then raise exception 'Meeting not found'; end if;
  if not public.is_active_member(v_row.household_id) then
    raise exception 'Not an active household member';
  end if;
  v_actor := public.current_membership_id(v_row.household_id);
  if v_row.organizer_membership_id <> v_actor and not public.is_household_coordinator(v_row.household_id) then
    raise exception 'Only the organizer can publish the recap';
  end if;
  if v_row.status not in ('completed', 'published') then
    raise exception 'Meeting must be completed before publishing';
  end if;

  insert into public.household_meeting_packet_versions (
    meeting_id, household_id, version, kind, created_by_membership_id
  ) values (
    v_row.id, v_row.household_id, v_row.packet_version, 'recap', v_actor
  )
  on conflict (meeting_id, version, kind) do update
    set created_by_membership_id = excluded.created_by_membership_id
  returning id into v_version_id;

  delete from public.household_meeting_snapshots
  where packet_version_id = v_version_id and projection = 'shared';

  insert into public.household_meeting_snapshots (
    meeting_id, household_id, packet_version_id, projection, payload
  ) values (
    v_row.id, v_row.household_id, v_version_id, 'shared', coalesce(p_recap_payload, '{}'::jsonb)
  );

  update public.household_meetings
  set status = 'published', published_at = coalesce(published_at, now()), updated_at = now()
  where id = v_row.id;

  return v_version_id;
end;
$$;

revoke all on function public.publish_meeting_recap(uuid, jsonb, text) from public;
grant execute on function public.publish_meeting_recap(uuid, jsonb, text) to authenticated;

create or replace function public.cancel_meeting(p_meeting_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.household_meetings%rowtype;
  v_actor uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_row from public.household_meetings where id = p_meeting_id for update;
  if not found then raise exception 'Meeting not found'; end if;
  if not public.is_active_member(v_row.household_id) then
    raise exception 'Not an active household member';
  end if;
  v_actor := public.current_membership_id(v_row.household_id);
  if v_row.organizer_membership_id <> v_actor and not public.is_household_coordinator(v_row.household_id) then
    raise exception 'Only the organizer can cancel the meeting';
  end if;
  if v_row.status in ('published', 'archived') then
    raise exception 'Cannot cancel a published or archived meeting';
  end if;
  update public.household_meetings
  set status = 'cancelled', cancelled_at = now(), updated_at = now()
  where id = v_row.id;
end;
$$;

revoke all on function public.cancel_meeting(uuid) from public;
grant execute on function public.cancel_meeting(uuid) to authenticated;

create or replace function public.update_meeting_section(
  p_meeting_id uuid,
  p_section_key text,
  p_included boolean default null,
  p_sort_order integer default null,
  p_organizer_note text default null,
  p_informational_only boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.household_meetings%rowtype;
  v_actor uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_row from public.household_meetings where id = p_meeting_id for update;
  if not found then raise exception 'Meeting not found'; end if;
  if not public.is_active_member(v_row.household_id) then
    raise exception 'Not an active household member';
  end if;
  v_actor := public.current_membership_id(v_row.household_id);
  if v_row.organizer_membership_id <> v_actor and not public.is_household_coordinator(v_row.household_id) then
    raise exception 'Only the organizer can update sections';
  end if;
  if v_row.status in ('locked', 'in_progress', 'completed', 'published', 'archived', 'cancelled') then
    -- Allow discussed/skipped markers only via mark helpers; structural edits blocked after lock.
    if p_included is not null or p_sort_order is not null or p_informational_only is not null then
      raise exception 'Cannot reorder or hide sections after the packet is locked';
    end if;
  end if;

  update public.household_meeting_sections
  set included = coalesce(p_included, included),
      sort_order = coalesce(p_sort_order, sort_order),
      organizer_note = coalesce(p_organizer_note, organizer_note),
      informational_only = coalesce(p_informational_only, informational_only),
      updated_at = now()
  where meeting_id = p_meeting_id and section_key = p_section_key;
end;
$$;

revoke all on function public.update_meeting_section(uuid, text, boolean, integer, text, boolean) from public;
grant execute on function public.update_meeting_section(uuid, text, boolean, integer, text, boolean) to authenticated;

create or replace function public.add_meeting_agenda_item(
  p_meeting_id uuid,
  p_section_key text,
  p_title text,
  p_why_included text default null,
  p_source text default 'custom',
  p_source_entity_type text default null,
  p_source_entity_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.household_meetings%rowtype;
  v_actor uuid;
  v_id uuid;
  v_order integer;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_row from public.household_meetings where id = p_meeting_id for update;
  if not found then raise exception 'Meeting not found'; end if;
  if not public.is_active_member(v_row.household_id) then
    raise exception 'Not an active household member';
  end if;
  v_actor := public.current_membership_id(v_row.household_id);
  if v_row.status in ('cancelled', 'archived') then
    raise exception 'Meeting is not editable';
  end if;

  select coalesce(max(sort_order), 0) + 1 into v_order
  from public.household_meeting_agenda_items where meeting_id = p_meeting_id;

  insert into public.household_meeting_agenda_items (
    meeting_id, household_id, section_key, source, title, why_included,
    source_entity_type, source_entity_id, status, sort_order, created_by_membership_id
  ) values (
    v_row.id, v_row.household_id, p_section_key, coalesce(p_source, 'custom'), trim(p_title),
    p_why_included, p_source_entity_type, p_source_entity_id,
    case when coalesce(p_source, 'custom') = 'suggested' then 'proposed' else 'accepted' end,
    v_order, v_actor
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.add_meeting_agenda_item(uuid, text, text, text, text, text, uuid) from public;
grant execute on function public.add_meeting_agenda_item(uuid, text, text, text, text, text, uuid) to authenticated;

create or replace function public.accept_suggested_agenda_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.household_meeting_agenda_items%rowtype;
  v_meeting public.household_meetings%rowtype;
  v_actor uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_item from public.household_meeting_agenda_items where id = p_item_id for update;
  if not found then raise exception 'Agenda item not found'; end if;
  select * into v_meeting from public.household_meetings where id = v_item.meeting_id;
  if not public.is_active_member(v_meeting.household_id) then
    raise exception 'Not an active household member';
  end if;
  v_actor := public.current_membership_id(v_meeting.household_id);
  if v_meeting.organizer_membership_id <> v_actor and not public.is_household_coordinator(v_meeting.household_id) then
    raise exception 'Only the organizer can accept suggestions';
  end if;
  update public.household_meeting_agenda_items
  set status = 'accepted', updated_at = now()
  where id = p_item_id;
end;
$$;

revoke all on function public.accept_suggested_agenda_item(uuid) from public;
grant execute on function public.accept_suggested_agenda_item(uuid) to authenticated;

create or replace function public.dismiss_suggested_agenda_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.household_meeting_agenda_items%rowtype;
  v_meeting public.household_meetings%rowtype;
  v_actor uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_item from public.household_meeting_agenda_items where id = p_item_id for update;
  if not found then raise exception 'Agenda item not found'; end if;
  select * into v_meeting from public.household_meetings where id = v_item.meeting_id;
  if not public.is_active_member(v_meeting.household_id) then
    raise exception 'Not an active household member';
  end if;
  v_actor := public.current_membership_id(v_meeting.household_id);
  if v_meeting.organizer_membership_id <> v_actor and not public.is_household_coordinator(v_meeting.household_id) then
    raise exception 'Only the organizer can dismiss suggestions';
  end if;
  update public.household_meeting_agenda_items
  set status = 'dismissed', updated_at = now()
  where id = p_item_id;
end;
$$;

revoke all on function public.dismiss_suggested_agenda_item(uuid) from public;
grant execute on function public.dismiss_suggested_agenda_item(uuid) to authenticated;

create or replace function public.record_meeting_note(
  p_meeting_id uuid,
  p_body text,
  p_section_key text default null,
  p_agenda_item_id uuid default null,
  p_parking_lot boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.household_meetings%rowtype;
  v_actor uuid;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_row from public.household_meetings where id = p_meeting_id;
  if not found then raise exception 'Meeting not found'; end if;
  if not public.is_active_member(v_row.household_id) then
    raise exception 'Not an active household member';
  end if;
  if v_row.status not in ('in_progress', 'completed') then
    raise exception 'Notes can only be recorded during or just after the meeting';
  end if;
  v_actor := public.current_membership_id(v_row.household_id);
  insert into public.household_meeting_session_notes (
    meeting_id, household_id, section_key, agenda_item_id, body, parking_lot, created_by_membership_id
  ) values (
    v_row.id, v_row.household_id, p_section_key, p_agenda_item_id, trim(p_body),
    coalesce(p_parking_lot, false), v_actor
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.record_meeting_note(uuid, text, text, uuid, boolean) from public;
grant execute on function public.record_meeting_note(uuid, text, text, uuid, boolean) to authenticated;

create or replace function public.record_meeting_decision(
  p_meeting_id uuid,
  p_decision_text text,
  p_agenda_item_id uuid default null,
  p_owner_membership_id uuid default null,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.household_meetings%rowtype;
  v_actor uuid;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_row from public.household_meetings where id = p_meeting_id;
  if not found then raise exception 'Meeting not found'; end if;
  if not public.is_active_member(v_row.household_id) then
    raise exception 'Not an active household member';
  end if;
  if v_row.status not in ('in_progress', 'completed') then
    raise exception 'Decisions can only be recorded during or just after the meeting';
  end if;
  v_actor := public.current_membership_id(v_row.household_id);

  if p_idempotency_key is not null then
    select id into v_id from public.household_meeting_decisions
    where client_idempotency_key = p_idempotency_key;
    if found then return v_id; end if;
  end if;

  insert into public.household_meeting_decisions (
    meeting_id, household_id, agenda_item_id, decision_text, owner_membership_id,
    created_by_membership_id, client_idempotency_key
  ) values (
    v_row.id, v_row.household_id, p_agenda_item_id, trim(p_decision_text), p_owner_membership_id,
    v_actor, p_idempotency_key
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.record_meeting_decision(uuid, text, uuid, uuid, text) from public;
grant execute on function public.record_meeting_decision(uuid, text, uuid, uuid, text) to authenticated;

create or replace function public.create_meeting_action_item(
  p_meeting_id uuid,
  p_title text,
  p_owner_membership_id uuid default null,
  p_due_date date default null,
  p_decision_id uuid default null,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.household_meetings%rowtype;
  v_actor uuid;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_row from public.household_meetings where id = p_meeting_id;
  if not found then raise exception 'Meeting not found'; end if;
  if not public.is_active_member(v_row.household_id) then
    raise exception 'Not an active household member';
  end if;
  if v_row.status not in ('in_progress', 'completed', 'published') then
    raise exception 'Action items require an active or completed meeting';
  end if;
  v_actor := public.current_membership_id(v_row.household_id);

  if p_idempotency_key is not null then
    select id into v_id from public.household_meeting_action_items
    where client_idempotency_key = p_idempotency_key;
    if found then return v_id; end if;
  end if;

  insert into public.household_meeting_action_items (
    meeting_id, household_id, decision_id, title, owner_membership_id, due_date,
    created_by_membership_id, client_idempotency_key
  ) values (
    v_row.id, v_row.household_id, p_decision_id, trim(p_title), p_owner_membership_id, p_due_date,
    v_actor, p_idempotency_key
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.create_meeting_action_item(uuid, text, uuid, date, uuid, text) from public;
grant execute on function public.create_meeting_action_item(uuid, text, uuid, date, uuid, text) to authenticated;

create or replace function public.mark_meeting_section_discussed(
  p_meeting_id uuid,
  p_section_key text,
  p_skipped boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.household_meetings%rowtype;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_row from public.household_meetings where id = p_meeting_id;
  if not found then raise exception 'Meeting not found'; end if;
  if not public.is_active_member(v_row.household_id) then
    raise exception 'Not an active household member';
  end if;
  if v_row.status <> 'in_progress' then
    raise exception 'Sections can only be marked during the meeting';
  end if;
  update public.household_meeting_sections
  set discussed_at = case when coalesce(p_skipped, false) then discussed_at else now() end,
      skipped_at = case when coalesce(p_skipped, false) then now() else skipped_at end,
      updated_at = now()
  where meeting_id = p_meeting_id and section_key = p_section_key;
end;
$$;

revoke all on function public.mark_meeting_section_discussed(uuid, text, boolean) from public;
grant execute on function public.mark_meeting_section_discussed(uuid, text, boolean) to authenticated;

create or replace function public.set_meeting_status_preparing(p_meeting_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.household_meetings%rowtype;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_row from public.household_meetings where id = p_meeting_id for update;
  if not found then raise exception 'Meeting not found'; end if;
  if not public.is_active_member(v_row.household_id) then
    raise exception 'Not an active household member';
  end if;
  if v_row.status not in ('draft', 'preparing', 'ready_for_review') then
    raise exception 'Cannot gather sources in status %', v_row.status;
  end if;
  update public.household_meetings
  set status = 'ready_for_review', updated_at = now()
  where id = v_row.id and status in ('draft', 'preparing');
end;
$$;

revoke all on function public.set_meeting_status_preparing(uuid) from public;
grant execute on function public.set_meeting_status_preparing(uuid) to authenticated;
