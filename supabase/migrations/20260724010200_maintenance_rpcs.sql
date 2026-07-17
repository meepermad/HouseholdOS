-- Phase 7B: core maintenance lifecycle RPCs

create or replace function public._maintenance_audit(
  p_household_id uuid, p_entity_type text, p_entity_id uuid, p_event_type text,
  p_before jsonb default null, p_after jsonb default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_events(
    household_id, actor_user_id, entity_type, entity_id, event_type,
    before_state, after_state, correlation_id
  ) values (
    p_household_id, auth.uid(), p_entity_type, p_entity_id, p_event_type,
    p_before, p_after, gen_random_uuid()
  );
end $$;
revoke all on function public._maintenance_audit(uuid,text,uuid,text,jsonb,jsonb) from public, anon;

create or replace function public._maintenance_notify(
  p_household_id uuid, p_event_type text, p_entity_id uuid,
  p_actor_membership_id uuid, p_memberships uuid[], p_title text, p_body text
) returns void language plpgsql security definer set search_path = public as $$
declare v_users uuid[];
begin
  select array_agg(distinct m.user_id) into v_users from public.household_memberships m
  where m.id = any(coalesce(p_memberships, '{}'::uuid[]))
    and m.status = 'active' and m.user_id <> auth.uid();
  if cardinality(coalesce(v_users, '{}'::uuid[])) > 0 then
    perform public._emit_notification_event(
      p_household_id, p_event_type, 'maintenance_request', p_entity_id,
      p_actor_membership_id, '{}'::jsonb,
      p_event_type || ':' || p_entity_id::text || ':' || extract(epoch from clock_timestamp())::bigint::text,
      v_users, p_title, p_body,
      '/app/' || p_household_id::text || '/maintenance/' || p_entity_id::text
    );
  end if;
end $$;
revoke all on function public._maintenance_notify(uuid,text,uuid,uuid,uuid[],text,text) from public, anon;

create or replace function public._maintenance_append_event(
  p_request_id uuid, p_household_id uuid, p_actor uuid,
  p_event_type text, p_body text default null, p_payload jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.maintenance_events(
    request_id, household_id, event_type, actor_membership_id, body, payload
  ) values (
    p_request_id, p_household_id, p_event_type, p_actor,
    nullif(trim(coalesce(p_body,'')),''), coalesce(p_payload, '{}'::jsonb)
  );
end $$;
revoke all on function public._maintenance_append_event(uuid,uuid,uuid,text,text,jsonb) from public, anon;

create or replace function public._maintenance_cancel_reminders(p_request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.scheduled_notification_requests
  set cancelled_at = now()
  where source_type = 'maintenance_request'
    and source_id = p_request_id
    and processed_at is null
    and cancelled_at is null;
end $$;
revoke all on function public._maintenance_cancel_reminders(uuid) from public, anon;

create or replace function public.create_maintenance_request(
  p_household_id uuid,
  p_title text,
  p_description text default null,
  p_category text default 'other',
  p_severity text default 'normal',
  p_visibility text default 'household',
  p_location_id uuid default null,
  p_inventory_item_id uuid default null,
  p_first_noticed_at date default null,
  p_currently_active boolean default true,
  p_stop_use boolean default false,
  p_immediate_mitigation text default null,
  p_hazard_flags text[] default '{}',
  p_suggested_coordinator_membership_id uuid default null,
  p_landlord_involvement boolean default false,
  p_participant_membership_ids uuid[] default '{}'
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid; v_id uuid; v_mid uuid; v_severity text;
begin
  perform set_config('householdos.maintenance_mutation', 'rpc', true);
  v_actor := public._maintenance_active_membership(p_household_id);
  v_severity := coalesce(nullif(trim(p_severity),''), 'normal');
  if p_hazard_flags is not null and exists (
    select 1 from unnest(p_hazard_flags) f
    where f in ('gas_odor','smoke_or_fire','carbon_monoxide_alarm','sparks_or_arcing','burning_smell','major_structural_movement','standing_water_near_electricity')
  ) and v_severity not in ('urgent','emergency_guidance') then
    v_severity := 'emergency_guidance';
  end if;

  if p_suggested_coordinator_membership_id is not null and not exists (
    select 1 from public.household_memberships m
    where m.id = p_suggested_coordinator_membership_id
      and m.household_id = p_household_id and m.status = 'active'
  ) then
    raise exception 'Suggested coordinator must be an active household member';
  end if;
  if p_location_id is not null and not exists (
    select 1 from public.household_locations l
    where l.id = p_location_id and l.household_id = p_household_id
  ) then raise exception 'Location must belong to this household'; end if;
  if p_inventory_item_id is not null and not exists (
    select 1 from public.inventory_items i
    where i.id = p_inventory_item_id and i.household_id = p_household_id
  ) then raise exception 'Inventory item must belong to this household'; end if;

  insert into public.maintenance_requests(
    household_id, title, description, category, severity, visibility, status,
    location_id, inventory_item_id, first_noticed_at, currently_active, stop_use,
    immediate_mitigation, hazard_flags, reporter_membership_id,
    suggested_coordinator_membership_id, landlord_involvement
  ) values (
    p_household_id, trim(p_title), nullif(trim(coalesce(p_description,'')),''),
    p_category, v_severity, coalesce(p_visibility,'household'), 'reported',
    p_location_id, p_inventory_item_id, p_first_noticed_at,
    coalesce(p_currently_active,true), coalesce(p_stop_use,false),
    nullif(trim(coalesce(p_immediate_mitigation,'')),''),
    coalesce(p_hazard_flags,'{}'::text[]), v_actor,
    p_suggested_coordinator_membership_id, coalesce(p_landlord_involvement,false)
  ) returning id into v_id;

  insert into public.maintenance_request_participants(request_id, household_id, membership_id, role)
  values (v_id, p_household_id, v_actor, 'collaborator')
  on conflict do nothing;

  foreach v_mid in array coalesce(p_participant_membership_ids, '{}'::uuid[])
  loop
    if not exists (
      select 1 from public.household_memberships m
      where m.id = v_mid and m.household_id = p_household_id and m.status = 'active'
    ) then raise exception 'Participant must be an active household member'; end if;
    insert into public.maintenance_request_participants(request_id, household_id, membership_id, role)
    values (v_id, p_household_id, v_mid, 'affected')
    on conflict do nothing;
  end loop;

  if p_inventory_item_id is not null then
    insert into public.maintenance_inventory_links(
      request_id, household_id, inventory_item_id, created_by_membership_id
    ) values (v_id, p_household_id, p_inventory_item_id, v_actor);
  end if;

  perform public._maintenance_append_event(v_id, p_household_id, v_actor, 'reported', null,
    jsonb_build_object('severity', v_severity, 'category', p_category));
  perform public._maintenance_audit(p_household_id, 'maintenance_request', v_id, 'maintenance.reported',
    null, jsonb_build_object('severity', v_severity, 'category', p_category));

  perform public._maintenance_notify(
    p_household_id, 'maintenance.reported', v_id, v_actor,
    array(
      select m.id from public.household_memberships m
      join public.household_membership_roles r on r.membership_id = m.id
      where m.household_id = p_household_id and m.status = 'active'
        and r.role = 'household_coordinator'
        and v_severity in ('high','urgent','emergency_guidance')
    ) || coalesce(array[p_suggested_coordinator_membership_id], '{}'::uuid[]),
    'Maintenance reported',
    'A household maintenance issue was reported.'
  );
  return v_id;
end $$;

create or replace function public.triage_maintenance_request(
  p_request_id uuid,
  p_severity text default null,
  p_primary_coordinator_membership_id uuid default null,
  p_note text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_req public.maintenance_requests%rowtype; v_actor uuid;
begin
  perform set_config('householdos.maintenance_mutation', 'rpc', true);
  select * into v_req from public.maintenance_requests where id = p_request_id for update;
  if not found then raise exception 'Maintenance request not found'; end if;
  v_actor := public._maintenance_active_membership(v_req.household_id);
  if v_req.status not in ('reported','reopened','triaged') then
    raise exception 'Invalid lifecycle transition';
  end if;
  if p_primary_coordinator_membership_id is not null and not exists (
    select 1 from public.household_memberships m
    where m.id = p_primary_coordinator_membership_id
      and m.household_id = v_req.household_id and m.status = 'active'
  ) then raise exception 'Coordinator must be an active household member'; end if;

  update public.maintenance_requests set
    status = 'triaged',
    severity = coalesce(p_severity, severity),
    primary_coordinator_membership_id = coalesce(p_primary_coordinator_membership_id, primary_coordinator_membership_id)
  where id = p_request_id;

  if p_primary_coordinator_membership_id is not null then
    insert into public.maintenance_assignments(
      request_id, household_id, membership_id, is_primary, assigned_by_membership_id
    ) values (p_request_id, v_req.household_id, p_primary_coordinator_membership_id, true, v_actor)
    on conflict (request_id, membership_id) do update set
      is_primary = true, unassigned_at = null, assigned_at = now();
  end if;

  perform public._maintenance_append_event(p_request_id, v_req.household_id, v_actor, 'triaged', p_note,
    jsonb_build_object('severity', coalesce(p_severity, v_req.severity)));
  perform public._maintenance_audit(v_req.household_id, 'maintenance_request', p_request_id, 'maintenance.triaged');
  return p_request_id;
end $$;

create or replace function public.assign_maintenance_request(
  p_request_id uuid,
  p_membership_id uuid,
  p_is_primary boolean default true
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_req public.maintenance_requests%rowtype; v_actor uuid;
begin
  perform set_config('householdos.maintenance_mutation', 'rpc', true);
  select * into v_req from public.maintenance_requests where id = p_request_id for update;
  if not found then raise exception 'Maintenance request not found'; end if;
  v_actor := public._maintenance_active_membership(v_req.household_id);
  if not exists (
    select 1 from public.household_memberships m
    where m.id = p_membership_id and m.household_id = v_req.household_id and m.status = 'active'
  ) then raise exception 'Assignee must be an active household member'; end if;

  if p_is_primary then
    update public.maintenance_assignments set is_primary = false
    where request_id = p_request_id and unassigned_at is null;
    update public.maintenance_requests set
      primary_coordinator_membership_id = p_membership_id,
      status = case when status in ('reported','triaged','reopened') then 'assigned' else status end
    where id = p_request_id;
  end if;

  insert into public.maintenance_assignments(
    request_id, household_id, membership_id, is_primary, assigned_by_membership_id
  ) values (p_request_id, v_req.household_id, p_membership_id, coalesce(p_is_primary,true), v_actor)
  on conflict (request_id, membership_id) do update set
    is_primary = excluded.is_primary, unassigned_at = null, assigned_at = now(),
    assigned_by_membership_id = excluded.assigned_by_membership_id;

  perform public._maintenance_append_event(p_request_id, v_req.household_id, v_actor, 'assigned', null,
    jsonb_build_object('assigned', true));
  perform public._maintenance_audit(v_req.household_id, 'maintenance_request', p_request_id, 'maintenance.assigned',
    null, jsonb_build_object('is_primary', p_is_primary));
  perform public._maintenance_notify(
    v_req.household_id, 'maintenance.assigned', p_request_id, v_actor,
    array[p_membership_id], 'Maintenance assigned', 'You were assigned follow-up on a maintenance issue.'
  );
  return p_request_id;
end $$;

create or replace function public.claim_maintenance_request(p_request_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_req public.maintenance_requests%rowtype; v_actor uuid;
begin
  perform set_config('householdos.maintenance_mutation', 'rpc', true);
  select * into v_req from public.maintenance_requests where id = p_request_id for update;
  if not found then raise exception 'Maintenance request not found'; end if;
  v_actor := public._maintenance_active_membership(v_req.household_id);
  return public.assign_maintenance_request(p_request_id, v_actor, true);
end $$;

create or replace function public.change_maintenance_waiting_status(
  p_request_id uuid,
  p_status text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_req public.maintenance_requests%rowtype; v_actor uuid;
begin
  perform set_config('householdos.maintenance_mutation', 'rpc', true);
  select * into v_req from public.maintenance_requests where id = p_request_id for update;
  if not found then raise exception 'Maintenance request not found'; end if;
  v_actor := public._maintenance_active_membership(v_req.household_id);
  if p_status not in (
    'waiting_on_household','waiting_on_landlord','waiting_on_vendor',
    'appointment_scheduled','in_progress','assigned'
  ) then raise exception 'Invalid waiting status'; end if;
  update public.maintenance_requests set status = p_status where id = p_request_id;
  perform public._maintenance_append_event(p_request_id, v_req.household_id, v_actor, 'waiting_status_changed', null,
    jsonb_build_object('status', p_status));
  perform public._maintenance_audit(v_req.household_id, 'maintenance_request', p_request_id, 'maintenance.waiting_status_changed',
    null, jsonb_build_object('status', p_status));
  perform public._maintenance_notify(
    v_req.household_id, 'maintenance.waiting_on_household', p_request_id, v_actor,
    case when p_status = 'waiting_on_household'
      then array[coalesce(v_req.primary_coordinator_membership_id, v_req.reporter_membership_id)]
      else '{}'::uuid[] end,
    'Maintenance waiting',
    'A maintenance issue is waiting on household action.'
  );
  return p_request_id;
end $$;

create or replace function public.add_maintenance_comment(p_request_id uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_req public.maintenance_requests%rowtype; v_actor uuid;
begin
  perform set_config('householdos.maintenance_mutation', 'rpc', true);
  select * into v_req from public.maintenance_requests where id = p_request_id for update;
  if not found then raise exception 'Maintenance request not found'; end if;
  if not public.can_view_maintenance_request(p_request_id) then raise exception 'Not authorized'; end if;
  v_actor := public._maintenance_active_membership(v_req.household_id);
  if char_length(trim(coalesce(p_body,''))) < 1 then raise exception 'Comment required'; end if;
  perform public._maintenance_append_event(p_request_id, v_req.household_id, v_actor, 'comment_added', p_body);
  perform public._maintenance_audit(v_req.household_id, 'maintenance_request', p_request_id, 'maintenance.comment_added');
  perform public._maintenance_notify(
    v_req.household_id, 'maintenance.comment_added', p_request_id, v_actor,
    array[coalesce(v_req.primary_coordinator_membership_id, v_req.reporter_membership_id)],
    'Maintenance update',
    'A comment was added to a maintenance issue.'
  );
  return p_request_id;
end $$;

create or replace function public.record_maintenance_mitigation(p_request_id uuid, p_mitigation text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_req public.maintenance_requests%rowtype; v_actor uuid;
begin
  perform set_config('householdos.maintenance_mutation', 'rpc', true);
  select * into v_req from public.maintenance_requests where id = p_request_id for update;
  if not found then raise exception 'Maintenance request not found'; end if;
  v_actor := public._maintenance_active_membership(v_req.household_id);
  update public.maintenance_requests
  set immediate_mitigation = trim(p_mitigation)
  where id = p_request_id;
  perform public._maintenance_append_event(p_request_id, v_req.household_id, v_actor, 'mitigation_recorded', p_mitigation);
  return p_request_id;
end $$;

create or replace function public.resolve_maintenance_request(
  p_request_id uuid,
  p_resolution_notes text default null,
  p_decision_outcome text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_req public.maintenance_requests%rowtype; v_actor uuid;
begin
  perform set_config('householdos.maintenance_mutation', 'rpc', true);
  select * into v_req from public.maintenance_requests where id = p_request_id for update;
  if not found then raise exception 'Maintenance request not found'; end if;
  v_actor := public._maintenance_active_membership(v_req.household_id);
  if v_req.status in ('resolved','closed','cancelled') then
    raise exception 'Invalid lifecycle transition';
  end if;
  update public.maintenance_requests set
    status = 'resolved',
    resolved_at = now(),
    resolution_notes = nullif(trim(coalesce(p_resolution_notes,'')),''),
    decision_outcome = p_decision_outcome
  where id = p_request_id;
  perform public._maintenance_cancel_reminders(p_request_id);
  perform public._maintenance_append_event(p_request_id, v_req.household_id, v_actor, 'resolved', p_resolution_notes,
    jsonb_build_object('decision', p_decision_outcome));
  perform public._maintenance_audit(v_req.household_id, 'maintenance_request', p_request_id, 'maintenance.resolved');
  perform public._maintenance_notify(
    v_req.household_id, 'maintenance.resolved', p_request_id, v_actor,
    array[v_req.reporter_membership_id, v_req.primary_coordinator_membership_id],
    'Maintenance resolved',
    'A maintenance issue was marked resolved.'
  );
  return p_request_id;
end $$;

create or replace function public.close_maintenance_request(p_request_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_req public.maintenance_requests%rowtype; v_actor uuid;
begin
  perform set_config('householdos.maintenance_mutation', 'rpc', true);
  select * into v_req from public.maintenance_requests where id = p_request_id for update;
  if not found then raise exception 'Maintenance request not found'; end if;
  v_actor := public._maintenance_active_membership(v_req.household_id);
  if v_req.status <> 'resolved' then raise exception 'Invalid lifecycle transition'; end if;
  update public.maintenance_requests set status = 'closed', closed_at = now() where id = p_request_id;
  perform public._maintenance_cancel_reminders(p_request_id);
  perform public._maintenance_append_event(p_request_id, v_req.household_id, v_actor, 'closed');
  perform public._maintenance_audit(v_req.household_id, 'maintenance_request', p_request_id, 'maintenance.closed');
  return p_request_id;
end $$;

create or replace function public.reopen_maintenance_request(p_request_id uuid, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_req public.maintenance_requests%rowtype; v_actor uuid;
begin
  perform set_config('householdos.maintenance_mutation', 'rpc', true);
  select * into v_req from public.maintenance_requests where id = p_request_id for update;
  if not found then raise exception 'Maintenance request not found'; end if;
  v_actor := public._maintenance_active_membership(v_req.household_id);
  if v_req.status not in ('resolved','closed') then raise exception 'Invalid lifecycle transition'; end if;
  update public.maintenance_requests set
    status = 'reopened', resolved_at = null, closed_at = null
  where id = p_request_id;
  perform public._maintenance_append_event(p_request_id, v_req.household_id, v_actor, 'reopened', p_note);
  perform public._maintenance_audit(v_req.household_id, 'maintenance_request', p_request_id, 'maintenance.reopened');
  perform public._maintenance_notify(
    v_req.household_id, 'maintenance.reopened', p_request_id, v_actor,
    array[v_req.reporter_membership_id, v_req.primary_coordinator_membership_id],
    'Maintenance reopened',
    'A maintenance issue was reopened.'
  );
  return p_request_id;
end $$;

create or replace function public.cancel_maintenance_request(p_request_id uuid, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_req public.maintenance_requests%rowtype; v_actor uuid;
begin
  perform set_config('householdos.maintenance_mutation', 'rpc', true);
  select * into v_req from public.maintenance_requests where id = p_request_id for update;
  if not found then raise exception 'Maintenance request not found'; end if;
  v_actor := public._maintenance_active_membership(v_req.household_id);
  if v_req.status in ('closed','cancelled') then raise exception 'Invalid lifecycle transition'; end if;
  update public.maintenance_requests set status = 'cancelled', cancelled_at = now() where id = p_request_id;
  update public.maintenance_chore_links set unlinked_at = now()
  where request_id = p_request_id and unlinked_at is null;
  perform public._maintenance_cancel_reminders(p_request_id);
  perform public._maintenance_append_event(p_request_id, v_req.household_id, v_actor, 'cancelled', p_note);
  perform public._maintenance_audit(v_req.household_id, 'maintenance_request', p_request_id, 'maintenance.cancelled');
  return p_request_id;
end $$;
