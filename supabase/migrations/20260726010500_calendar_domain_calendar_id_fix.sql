-- Phase 9 fix: domain calendar inserts must set calendar_id (NOT NULL)

create or replace function public._calendar_default_household_calendar_id(p_household_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select c.id into v_id
  from public.household_calendars c
  where c.household_id = p_household_id
    and c.calendar_type = 'household'
    and c.is_archived = false
  order by c.created_at
  limit 1;
  return v_id;
end;
$$;

revoke all on function public._calendar_default_household_calendar_id(uuid) from public;
grant execute on function public._calendar_default_household_calendar_id(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Chore calendar link
-- ---------------------------------------------------------------------------
create or replace function public._link_chore_occurrence_calendar(p_occurrence_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_occ public.chore_occurrences%rowtype;
  v_def public.chore_definitions%rowtype;
  v_event uuid;
  v_cal uuid;
begin
  perform set_config('householdos.calendar_mutation','rpc',true);
  perform set_config('householdos.chore_mutation','rpc',true);
  select * into v_occ from public.chore_occurrences where id=p_occurrence_id;
  if not found then return null; end if;
  select * into v_def from public.chore_definitions where id=v_occ.definition_id;
  if not v_def.show_on_calendar then
    if v_occ.calendar_event_id is not null then
      update public.calendar_events
      set status='cancelled',cancelled_at=now(),
          cancelled_by_membership_id=v_def.created_by_membership_id,
          cancellation_reason='Chore calendar display disabled'
      where id=v_occ.calendar_event_id and status='scheduled';
    end if;
    return null;
  end if;
  v_cal := public._calendar_default_household_calendar_id(v_occ.household_id);
  if v_cal is null then
    raise exception 'Household calendar missing for chore link';
  end if;
  if v_occ.calendar_event_id is null then
    insert into public.calendar_events(
      household_id, calendar_id, organizer_membership_id, title, description, category, visibility, status, all_day,
      starts_at, ends_at, start_date, end_date_exclusive, time_zone, calendar_uid,
      source_type, source_id, client_idempotency_key, lifecycle_owner, is_editable, is_deletable
    )
    values(
      v_occ.household_id, v_cal, v_def.created_by_membership_id, v_def.title, v_def.description,
      case when v_def.calendar_category='chores' then 'cleaning' else 'other' end,
      case when v_def.visibility='household' then 'household' else 'participants' end,
      'scheduled', v_occ.all_day,
      case when not v_occ.all_day then v_occ.due_at end,
      case when not v_occ.all_day then v_occ.due_at+interval '30 minutes' end,
      case when v_occ.all_day then v_occ.due_date end,
      case when v_occ.all_day then v_occ.due_date+1 end,
      v_def.time_zone,
      'householdos-chore-'||v_occ.id::text||'@householdos.app',
      'chore', v_occ.id, 'chore:'||v_occ.id::text,
      'domain', false, false
    )
    returning id into v_event;
    update public.chore_occurrences set calendar_event_id=v_event where id=p_occurrence_id;
  else
    v_event:=v_occ.calendar_event_id;
    update public.calendar_events set title=v_def.title,description=v_def.description,all_day=v_occ.all_day,
      starts_at=case when not v_occ.all_day then v_occ.due_at end,
      ends_at=case when not v_occ.all_day then v_occ.due_at+interval '30 minutes' end,
      start_date=case when v_occ.all_day then v_occ.due_date end,
      end_date_exclusive=case when v_occ.all_day then v_occ.due_date+1 end,
      sequence=sequence+1 where id=v_event;
  end if;
  return v_event;
end $$;

-- ---------------------------------------------------------------------------
-- Maintenance appointment scheduling (latest body from sql_lint_cleanup)
-- ---------------------------------------------------------------------------
create or replace function public.schedule_maintenance_appointment(
  p_request_id uuid,
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_appointment_kind text default 'vendor_visit',
  p_location text default null,
  p_all_day boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_req public.maintenance_requests%rowtype;
  v_actor uuid;
  v_event_id uuid;
  v_link_id uuid;
  v_cal uuid;
begin
  perform set_config('householdos.maintenance_mutation', 'rpc', true);
  perform set_config('householdos.calendar_mutation', 'rpc', true);
  select * into v_req from public.maintenance_requests where id = p_request_id for update;
  if not found then raise exception 'Maintenance request not found'; end if;
  v_actor := public._maintenance_active_membership(v_req.household_id);
  v_cal := public._calendar_default_household_calendar_id(v_req.household_id);
  if v_cal is null then raise exception 'Household calendar missing'; end if;

  insert into public.calendar_events(
    household_id, calendar_id, organizer_membership_id,
    title, starts_at, ends_at, all_day, category, visibility, status,
    source_type, source_id, location, calendar_uid, client_idempotency_key,
    lifecycle_owner, is_editable, is_deletable
  ) values (
    v_req.household_id, v_cal, v_actor,
    trim(p_title), p_starts_at, p_ends_at, coalesce(p_all_day,false),
    'maintenance', 'household', 'scheduled',
    'maintenance_request', p_request_id,
    nullif(trim(coalesce(p_location,'')),''),
    'householdos-maintenance-' || p_request_id::text || '-' || gen_random_uuid()::text || '@householdos.app',
    'maintenance-appt:' || p_request_id::text || ':' || extract(epoch from clock_timestamp())::bigint::text,
    'domain', false, false
  ) returning id into v_event_id;

  insert into public.maintenance_calendar_links(
    request_id, household_id, calendar_event_id, appointment_kind, created_by_membership_id
  ) values (
    p_request_id, v_req.household_id, v_event_id, coalesce(p_appointment_kind,'vendor_visit'), v_actor
  ) returning id into v_link_id;

  update public.maintenance_requests
  set status = case
    when status in ('cancelled','closed') then status
    else 'appointment_scheduled'
  end
  where id = p_request_id;

  perform public._maintenance_audit(
    v_req.household_id, 'maintenance_request', p_request_id, 'maintenance.appointment_scheduled',
    null, jsonb_build_object('link_id', v_link_id, 'event_id', v_event_id), null, null
  );

  return v_event_id;
end;
$$;

grant execute on function public.schedule_maintenance_appointment(uuid, text, timestamptz, timestamptz, text, text, boolean) to authenticated;
