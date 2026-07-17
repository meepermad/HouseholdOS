-- Phase 8 tech debt: use previously unused v_link_id in audit/event payloads

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
begin
  perform set_config('householdos.maintenance_mutation', 'rpc', true);
  perform set_config('householdos.calendar_mutation', 'rpc', true);
  select * into v_req from public.maintenance_requests where id = p_request_id for update;
  if not found then raise exception 'Maintenance request not found'; end if;
  v_actor := public._maintenance_active_membership(v_req.household_id);

  insert into public.calendar_events(
    household_id, organizer_membership_id,
    title, starts_at, ends_at, all_day, category, visibility, status,
    source_type, source_id, location, calendar_uid, client_idempotency_key
  ) values (
    v_req.household_id, v_actor,
    trim(p_title), p_starts_at, p_ends_at, coalesce(p_all_day,false),
    'maintenance', 'household', 'scheduled',
    'maintenance_request', p_request_id,
    nullif(trim(coalesce(p_location,'')),''),
    'householdos-maintenance-' || p_request_id::text || '-' || gen_random_uuid()::text || '@householdos.app',
    'maintenance-appt:' || p_request_id::text || ':' || extract(epoch from clock_timestamp())::bigint::text
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

  perform public._maintenance_append_event(
    p_request_id, v_req.household_id, v_actor, 'appointment_scheduled', null,
    jsonb_build_object('calendar_event_id', v_event_id, 'link_id', v_link_id)
  );
  perform public._maintenance_audit(
    v_req.household_id, 'maintenance_request', p_request_id, 'maintenance.appointment_scheduled',
    null, jsonb_build_object('calendar_event_id', v_event_id, 'link_id', v_link_id)
  );
  perform public._maintenance_notify(
    v_req.household_id, 'maintenance.appointment_scheduled', p_request_id, v_actor,
    array[coalesce(v_req.primary_coordinator_membership_id, v_req.reporter_membership_id)],
    'Maintenance appointment',
    'A maintenance appointment was scheduled.'
  );
  return v_event_id;
end $$;
