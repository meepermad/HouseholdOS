-- Phase 5: secure chore and responsibility lifecycle RPCs

create or replace function public._chore_assert_member(p_household_id uuid, p_membership_id uuid)
returns void language plpgsql stable security definer set search_path=public as $$
begin
  if not exists (select 1 from public.household_memberships where id=p_membership_id and household_id=p_household_id and status='active')
  then raise exception 'Membership is not active in this household'; end if;
end $$;
revoke all on function public._chore_assert_member(uuid,uuid) from public,anon;

create or replace function public._chore_audit(p_household_id uuid,p_entity_type text,p_entity_id uuid,p_event_type text,p_before jsonb default null,p_after jsonb default null,p_reason text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  insert into public.audit_events(household_id,actor_user_id,entity_type,entity_id,event_type,before_state,after_state,reason,correlation_id)
  values(p_household_id,auth.uid(),p_entity_type,p_entity_id,p_event_type,p_before,p_after,p_reason,gen_random_uuid());
end $$;
revoke all on function public._chore_audit(uuid,text,uuid,text,jsonb,jsonb,text) from public,anon;

create or replace function public._chore_notify(p_household_id uuid,p_event_type text,p_entity_type text,p_entity_id uuid,p_actor uuid,p_memberships uuid[])
returns void language plpgsql security definer set search_path=public as $$
declare v_users uuid[];
begin
  select array_agg(distinct m.user_id) into v_users from public.household_memberships m
  where m.id=any(coalesce(p_memberships,'{}'::uuid[])) and m.status='active' and m.user_id<>auth.uid();
  if cardinality(coalesce(v_users,'{}'::uuid[]))>0 then
    perform public._emit_notification_event(p_household_id,p_event_type,p_entity_type,p_entity_id,p_actor,'{}',
      p_event_type||':'||p_entity_id::text||':'||extract(epoch from clock_timestamp())::bigint::text,v_users,
      'Chore update','A household chore was updated.','/app/'||p_household_id::text||'/chores/'||p_entity_id::text);
  end if;
end $$;
revoke all on function public._chore_notify(uuid,text,text,uuid,uuid,uuid[]) from public,anon;

create or replace function public.create_chore_rotation(p_household_id uuid,p_name text,p_strategy text,p_start_membership_id uuid default null,p_membership_ids uuid[] default '{}')
returns uuid language plpgsql security definer set search_path=public as $$
declare v_actor uuid; v_id uuid; v_mid uuid; v_order int:=0;
begin
  perform set_config('householdos.chore_mutation','rpc',true);
  v_actor:=public._chore_active_membership(p_household_id);
  if not public.is_household_coordinator(p_household_id) then raise exception 'Household coordinator required'; end if;
  if p_strategy not in ('fixed','round_robin','balanced','manual_sequence') then raise exception 'Invalid rotation strategy'; end if;
  if p_start_membership_id is not null then perform public._chore_assert_member(p_household_id,p_start_membership_id); end if;
  insert into public.chore_rotations(household_id,name,strategy,start_membership_id,created_by_membership_id)
  values(p_household_id,trim(p_name),p_strategy,p_start_membership_id,v_actor) returning id into v_id;
  foreach v_mid in array coalesce(p_membership_ids,'{}') loop
    perform public._chore_assert_member(p_household_id,v_mid);
    insert into public.chore_rotation_members(rotation_id,household_id,membership_id,sort_order) values(v_id,p_household_id,v_mid,v_order);
    v_order:=v_order+1;
  end loop;
  perform public._chore_audit(p_household_id,'chore_rotation',v_id,'chore.rotation_created',null,jsonb_build_object('strategy',p_strategy));
  return v_id;
end $$;

create or replace function public.update_chore_rotation_members(p_rotation_id uuid,p_membership_ids uuid[])
returns uuid language plpgsql security definer set search_path=public as $$
declare v_rotation public.chore_rotations%rowtype; v_mid uuid; v_order int:=0;
begin
  perform set_config('householdos.chore_mutation','rpc',true);
  select * into v_rotation from public.chore_rotations where id=p_rotation_id for update;
  if not found then raise exception 'Rotation not found'; end if;
  perform public._chore_active_membership(v_rotation.household_id);
  if not public.is_household_coordinator(v_rotation.household_id) then raise exception 'Household coordinator required'; end if;
  delete from public.chore_rotation_members where rotation_id=p_rotation_id;
  foreach v_mid in array coalesce(p_membership_ids,'{}') loop
    perform public._chore_assert_member(v_rotation.household_id,v_mid);
    insert into public.chore_rotation_members(rotation_id,household_id,membership_id,sort_order) values(p_rotation_id,v_rotation.household_id,v_mid,v_order);
    v_order:=v_order+1;
  end loop;
  perform public._chore_audit(v_rotation.household_id,'chore_rotation',p_rotation_id,'chore.rotation_members_updated');
  return p_rotation_id;
end $$;

create or replace function public.update_chore_rotation(
  p_rotation_id uuid,p_name text default null,p_strategy text default null,
  p_start_membership_id uuid default null,p_paused boolean default null,p_ended boolean default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_rotation public.chore_rotations%rowtype;
begin
  perform set_config('householdos.chore_mutation','rpc',true);
  select * into v_rotation from public.chore_rotations where id=p_rotation_id for update;
  if not found then raise exception 'Rotation not found'; end if;
  perform public._chore_active_membership(v_rotation.household_id);
  if not public.is_household_coordinator(v_rotation.household_id) then raise exception 'Household coordinator required'; end if;
  if p_strategy is not null and p_strategy not in ('fixed','round_robin','balanced','manual_sequence') then raise exception 'Invalid rotation strategy'; end if;
  if p_start_membership_id is not null then perform public._chore_assert_member(v_rotation.household_id,p_start_membership_id); end if;
  update public.chore_rotations set
    name=coalesce(nullif(trim(coalesce(p_name,'')),''),name),
    strategy=coalesce(p_strategy,strategy),
    start_membership_id=coalesce(p_start_membership_id,start_membership_id),
    paused_at=case when p_ended=true then null when p_paused=true then coalesce(paused_at,now()) when p_paused=false then null else paused_at end,
    ended_at=case when p_ended=true then coalesce(ended_at,now()) when p_ended=false then null else ended_at end
  where id=p_rotation_id;
  perform public._chore_audit(v_rotation.household_id,'chore_rotation',p_rotation_id,'chore.rotation_updated');
  return p_rotation_id;
end $$;

create or replace function public.create_chore_definition(
  p_household_id uuid,p_title text,p_category text,p_start_date date,p_rrule text,
  p_all_day boolean default false,p_due_time_minutes int default null,p_description text default null,
  p_visibility text default 'household',p_time_zone text default 'America/Chicago',p_end_date date default null,
  p_recurrence_count int default null,p_grace_period_minutes int default 120,p_requires_verification boolean default false,
  p_verifier_membership_id uuid default null,p_show_on_calendar boolean default true,p_calendar_category text default 'chores',
  p_rotation_id uuid default null,p_responsibility_area_id uuid default null,p_reminder_offsets int[] default '{1440,120}',
  p_escalation_coordinator boolean default false)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_actor uuid; v_id uuid;
begin
  perform set_config('householdos.chore_mutation','rpc',true);
  v_actor:=public._chore_active_membership(p_household_id);
  if p_rrule is null or trim(p_rrule)='' then raise exception 'Recurring chore requires RRULE'; end if;
  if p_verifier_membership_id is not null then perform public._chore_assert_member(p_household_id,p_verifier_membership_id); end if;
  insert into public.chore_definitions(household_id,created_by_membership_id,title,description,category,visibility,rrule,time_zone,
    all_day,due_time_minutes,start_date,end_date,recurrence_count,grace_period_minutes,requires_verification,
    verifier_membership_id,show_on_calendar,calendar_category,rotation_id,responsibility_area_id,reminder_offsets,escalation_coordinator)
  values(p_household_id,v_actor,trim(p_title),nullif(trim(coalesce(p_description,'')),''),p_category,p_visibility,trim(p_rrule),p_time_zone,
    p_all_day,p_due_time_minutes,p_start_date,p_end_date,p_recurrence_count,p_grace_period_minutes,p_requires_verification,
    p_verifier_membership_id,p_show_on_calendar,p_calendar_category,p_rotation_id,p_responsibility_area_id,p_reminder_offsets,p_escalation_coordinator)
  returning id into v_id;
  perform public._chore_audit(p_household_id,'chore_definition',v_id,'chore.definition_created');
  return v_id;
end $$;

create or replace function public.create_one_time_chore(
  p_household_id uuid,p_title text,p_category text,p_due_at timestamptz,p_assignee_membership_ids uuid[] default '{}',
  p_description text default null,p_visibility text default 'household',p_all_day boolean default false,p_due_date date default null,
  p_grace_period_minutes int default 120,p_requires_verification boolean default false,p_verifier_membership_id uuid default null,
  p_show_on_calendar boolean default true,p_responsibility_area_id uuid default null,p_reminder_offsets int[] default '{1440,120}')
returns uuid language plpgsql security definer set search_path=public as $$
declare v_actor uuid; v_def uuid; v_occ uuid; v_mid uuid;
begin
  perform set_config('householdos.chore_mutation','rpc',true);
  v_actor:=public._chore_active_membership(p_household_id);
  if p_verifier_membership_id is not null then perform public._chore_assert_member(p_household_id,p_verifier_membership_id); end if;
  insert into public.chore_definitions(household_id,created_by_membership_id,title,description,category,visibility,time_zone,all_day,
    due_time_minutes,start_date,grace_period_minutes,requires_verification,verifier_membership_id,show_on_calendar,responsibility_area_id,reminder_offsets)
  values(p_household_id,v_actor,trim(p_title),nullif(trim(coalesce(p_description,'')),''),p_category,p_visibility,'America/Chicago',p_all_day,
    case when p_all_day then null else extract(hour from p_due_at at time zone 'America/Chicago')::int*60+extract(minute from p_due_at at time zone 'America/Chicago')::int end,
    coalesce(p_due_date,(p_due_at at time zone 'America/Chicago')::date),p_grace_period_minutes,p_requires_verification,p_verifier_membership_id,
    p_show_on_calendar,p_responsibility_area_id,p_reminder_offsets) returning id into v_def;
  insert into public.chore_occurrences(definition_id,household_id,occurrence_index,original_due_at,due_at,all_day,due_date,grace_ends_at)
  values(v_def,p_household_id,0,p_due_at,p_due_at,p_all_day,case when p_all_day then coalesce(p_due_date,p_due_at::date) end,p_due_at+make_interval(mins=>p_grace_period_minutes))
  returning id into v_occ;
  foreach v_mid in array coalesce(p_assignee_membership_ids,'{}') loop
    perform public._chore_assert_member(p_household_id,v_mid);
    insert into public.chore_assignments(occurrence_id,household_id,membership_id,role) values(v_occ,p_household_id,v_mid,'primary') on conflict do nothing;
  end loop;
  if p_verifier_membership_id is not null then
    insert into public.chore_assignments(occurrence_id,household_id,membership_id,role) values(v_occ,p_household_id,p_verifier_membership_id,'verifier')
    on conflict(occurrence_id,membership_id) do update set role='verifier';
  end if;
  perform public._link_chore_occurrence_calendar(v_occ);
  perform public._reconcile_chore_reminders(v_occ);
  perform public._chore_audit(p_household_id,'chore_definition',v_def,'chore.definition_created');
  perform public._chore_notify(p_household_id,'chore.assigned','chore_occurrence',v_occ,v_actor,p_assignee_membership_ids);
  return v_def;
end $$;

create or replace function public.update_chore_definition(p_definition_id uuid,p_changes jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_def public.chore_definitions%rowtype; v_actor uuid;
begin
  perform set_config('householdos.chore_mutation','rpc',true);
  select * into v_def from public.chore_definitions where id=p_definition_id for update;
  if not found then raise exception 'Chore definition not found'; end if;
  v_actor:=public._chore_active_membership(v_def.household_id);
  if v_actor<>v_def.created_by_membership_id and not public.is_household_coordinator(v_def.household_id) then raise exception 'Not authorized'; end if;
  update public.chore_definitions set
    title=coalesce(nullif(trim(p_changes->>'title'),''),title),
    description=case when p_changes?'description' then nullif(trim(p_changes->>'description'),'') else description end,
    category=coalesce(p_changes->>'category',category), visibility=coalesce(p_changes->>'visibility',visibility),
    rrule=case when p_changes?'rrule' then nullif(trim(p_changes->>'rrule'),'') else rrule end,
    time_zone=coalesce(p_changes->>'time_zone',time_zone),
    grace_period_minutes=coalesce((p_changes->>'grace_period_minutes')::int,grace_period_minutes),
    show_on_calendar=coalesce((p_changes->>'show_on_calendar')::boolean,show_on_calendar),
    reminder_offsets=case when p_changes?'reminder_offsets'
      then array(select jsonb_array_elements_text(p_changes->'reminder_offsets')::int)
      else reminder_offsets end,
    materialized_through=null where id=p_definition_id;
  perform public._chore_audit(v_def.household_id,'chore_definition',p_definition_id,'chore.definition_updated');
  return p_definition_id;
end $$;

create or replace function public._set_chore_definition_status(p_definition_id uuid,p_status text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_def public.chore_definitions%rowtype; v_actor uuid;
begin
  perform set_config('householdos.chore_mutation','rpc',true);
  select * into v_def from public.chore_definitions where id=p_definition_id for update;
  if not found then raise exception 'Chore definition not found'; end if;
  v_actor:=public._chore_active_membership(v_def.household_id);
  if v_actor<>v_def.created_by_membership_id and not public.is_household_coordinator(v_def.household_id) then raise exception 'Not authorized'; end if;
  update public.chore_definitions set status=p_status,paused_at=case when p_status='paused' then now() end,
    ended_at=case when p_status='ended' then now() end where id=p_definition_id;
  if p_status in ('paused','ended') then
    update public.scheduled_notification_requests set cancelled_at=now(),updated_at=now()
    where source_type='chore_occurrence' and source_id in(select id from public.chore_occurrences where definition_id=p_definition_id)
      and processed_at is null and cancelled_at is null;
  end if;
  perform public._chore_audit(v_def.household_id,'chore_definition',p_definition_id,'chore.definition_'||p_status);
  return p_definition_id;
end $$;
create or replace function public.pause_chore_definition(p_definition_id uuid) returns uuid language sql security definer set search_path=public as $$select public._set_chore_definition_status(p_definition_id,'paused')$$;
create or replace function public.resume_chore_definition(p_definition_id uuid) returns uuid language sql security definer set search_path=public as $$select public._set_chore_definition_status(p_definition_id,'active')$$;
create or replace function public.end_chore_definition(p_definition_id uuid) returns uuid language sql security definer set search_path=public as $$select public._set_chore_definition_status(p_definition_id,'ended')$$;

create or replace function public.materialize_chore_occurrences(p_definition_id uuid,p_occurrences jsonb)
returns int language plpgsql security definer set search_path=public as $$
declare v_def public.chore_definitions%rowtype; v_item jsonb; v_occ uuid; v_mid uuid; v_actor uuid; v_count int:=0;
begin
  perform set_config('householdos.chore_mutation','rpc',true);
  select * into v_def from public.chore_definitions where id=p_definition_id for update;
  if not found then raise exception 'Chore definition not found'; end if;
  if coalesce(auth.jwt()->>'role','')<>'service_role' then
    v_actor:=public._chore_active_membership(v_def.household_id);
    if v_actor<>v_def.created_by_membership_id and not public.is_household_coordinator(v_def.household_id)
    then raise exception 'Definition creator or coordinator required'; end if;
  end if;
  if jsonb_typeof(p_occurrences)<>'array' then raise exception 'Occurrences must be an array'; end if;
  for v_item in select value from jsonb_array_elements(p_occurrences) loop
    insert into public.chore_occurrences(definition_id,household_id,occurrence_index,original_due_at,due_at,all_day,due_date,grace_ends_at)
    values(p_definition_id,v_def.household_id,(v_item->>'occurrence_index')::int,(v_item->>'original_due_at')::timestamptz,
      (v_item->>'due_at')::timestamptz,coalesce((v_item->>'all_day')::boolean,false),(v_item->>'due_date')::date,
      (v_item->>'due_at')::timestamptz+make_interval(mins=>v_def.grace_period_minutes))
    on conflict(definition_id,original_due_at) do update set
      due_at=case when chore_occurrences.status in('completed','skipped','cancelled','verified','reopened') then chore_occurrences.due_at else excluded.due_at end,
      all_day=case when chore_occurrences.status in('completed','skipped','cancelled','verified','reopened') then chore_occurrences.all_day else excluded.all_day end,
      due_date=case when chore_occurrences.status in('completed','skipped','cancelled','verified','reopened') then chore_occurrences.due_date else excluded.due_date end,
      grace_ends_at=case when chore_occurrences.status in('completed','skipped','cancelled','verified','reopened') then chore_occurrences.grace_ends_at else excluded.grace_ends_at end
    returning id into v_occ;
    if not exists(select 1 from public.chore_assignments where occurrence_id=v_occ) then
      for v_mid in select jsonb_array_elements_text(coalesce(v_item->'membership_ids','[]'))::uuid loop
        perform public._chore_assert_member(v_def.household_id,v_mid);
        insert into public.chore_assignments(occurrence_id,household_id,membership_id,role) values(v_occ,v_def.household_id,v_mid,'primary') on conflict do nothing;
      end loop;
      if v_def.verifier_membership_id is not null then
        insert into public.chore_assignments(occurrence_id,household_id,membership_id,role) values(v_occ,v_def.household_id,v_def.verifier_membership_id,'verifier') on conflict do nothing;
      end if;
    end if;
    perform public._link_chore_occurrence_calendar(v_occ);
    perform public._reconcile_chore_reminders(v_occ);
    v_count:=v_count+1;
  end loop;
  update public.chore_definitions set materialized_through=(select max((x->>'due_at')::timestamptz) from jsonb_array_elements(p_occurrences)x) where id=p_definition_id;
  perform public._chore_audit(v_def.household_id,'chore_definition',p_definition_id,'chore.occurrences_materialized',
    null,jsonb_build_object('count',v_count));
  return v_count;
end $$;

create or replace function public.assign_chore_occurrence(p_occurrence_id uuid,p_membership_id uuid,p_role text default 'primary')
returns uuid language plpgsql security definer set search_path=public as $$
declare v_occ public.chore_occurrences%rowtype; v_def public.chore_definitions%rowtype; v_actor uuid; v_id uuid;
begin
  perform set_config('householdos.chore_mutation','rpc',true);
  select * into v_occ from public.chore_occurrences where id=p_occurrence_id for update;
  if not found then raise exception 'Occurrence not found'; end if;
  select * into v_def from public.chore_definitions where id=v_occ.definition_id;
  v_actor:=public._chore_active_membership(v_occ.household_id);
  if v_actor<>v_def.created_by_membership_id and not public.is_household_coordinator(v_occ.household_id) then raise exception 'Not authorized'; end if;
  perform public._chore_assert_member(v_occ.household_id,p_membership_id);
  insert into public.chore_assignments(occurrence_id,household_id,membership_id,role) values(p_occurrence_id,v_occ.household_id,p_membership_id,p_role)
  on conflict(occurrence_id,membership_id) do update set role=excluded.role,status='assigned',assigned_at=now() returning id into v_id;
  update public.chore_occurrences set assignment_version=assignment_version+1 where id=p_occurrence_id;
  perform public._chore_audit(v_occ.household_id,'chore_occurrence',p_occurrence_id,'chore.assigned');
  perform public._chore_notify(v_occ.household_id,'chore.assigned','chore_occurrence',p_occurrence_id,v_actor,array[p_membership_id]);
  return v_id;
end $$;

create or replace function public.claim_chore_occurrence(p_occurrence_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_occ public.chore_occurrences%rowtype; v_actor uuid; v_id uuid;
begin
  perform set_config('householdos.chore_mutation','rpc',true);
  select * into v_occ from public.chore_occurrences where id=p_occurrence_id for update;
  if not found or v_occ.status not in('scheduled','reopened') then raise exception 'Occurrence cannot be claimed'; end if;
  v_actor:=public._chore_active_membership(v_occ.household_id);
  insert into public.chore_assignments(occurrence_id,household_id,membership_id,role,status)
  values(p_occurrence_id,v_occ.household_id,v_actor,'primary','claimed')
  on conflict(occurrence_id,membership_id) do update set status='claimed',role='primary',accepted_at=now() returning id into v_id;
  update public.chore_occurrences set assignment_version=assignment_version+1 where id=p_occurrence_id;
  perform public._chore_audit(v_occ.household_id,'chore_occurrence',p_occurrence_id,'chore.claimed');
  return v_id;
end $$;

create or replace function public.request_chore_reassignment(p_occurrence_id uuid,p_reason text,p_suggested_membership_id uuid default null,p_requested_effective_at timestamptz default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_occ public.chore_occurrences%rowtype; v_actor uuid; v_id uuid;
begin
  perform set_config('householdos.chore_mutation','rpc',true);
  select * into v_occ from public.chore_occurrences where id=p_occurrence_id;
  if not found then raise exception 'Occurrence not found'; end if;
  v_actor:=public._chore_active_membership(v_occ.household_id);
  if not public.is_chore_assignee(p_occurrence_id) then raise exception 'Only an assignee may request reassignment'; end if;
  if p_suggested_membership_id is not null then perform public._chore_assert_member(v_occ.household_id,p_suggested_membership_id); end if;
  insert into public.chore_reassignment_requests(occurrence_id,household_id,requested_by_membership_id,suggested_membership_id,reason,requested_effective_at)
  values(p_occurrence_id,v_occ.household_id,v_actor,p_suggested_membership_id,trim(p_reason),p_requested_effective_at) returning id into v_id;
  perform public._chore_audit(v_occ.household_id,'chore_reassignment',v_id,'chore.reassignment_requested');
  return v_id;
end $$;

create or replace function public._resolve_chore_reassignment(p_request_id uuid,p_status text,p_resolution_note text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_req public.chore_reassignment_requests%rowtype; v_actor uuid;
begin
  perform set_config('householdos.chore_mutation','rpc',true);
  select * into v_req from public.chore_reassignment_requests where id=p_request_id for update;
  if not found or v_req.status<>'pending' then raise exception 'Pending request not found'; end if;
  v_actor:=public._chore_active_membership(v_req.household_id);
  if not public.is_household_coordinator(v_req.household_id) then raise exception 'Household coordinator required'; end if;
  update public.chore_reassignment_requests set status=p_status,resolved_by_membership_id=v_actor,resolved_at=now(),resolution_note=p_resolution_note where id=p_request_id;
  if p_status='approved' and v_req.suggested_membership_id is not null then
    update public.chore_assignments set status='released' where occurrence_id=v_req.occurrence_id and role='primary';
    perform public.assign_chore_occurrence(v_req.occurrence_id,v_req.suggested_membership_id,'primary');
  end if;
  perform public._chore_audit(v_req.household_id,'chore_reassignment',p_request_id,'chore.reassignment_'||p_status);
  return p_request_id;
end $$;
create or replace function public.approve_chore_reassignment(p_request_id uuid,p_resolution_note text default null) returns uuid language sql security definer set search_path=public as $$select public._resolve_chore_reassignment(p_request_id,'approved',p_resolution_note)$$;
create or replace function public.decline_chore_reassignment(p_request_id uuid,p_resolution_note text default null) returns uuid language sql security definer set search_path=public as $$select public._resolve_chore_reassignment(p_request_id,'declined',p_resolution_note)$$;

create or replace function public._transition_chore_occurrence(p_occurrence_id uuid,p_action text,p_reason text default null,p_note text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_occ public.chore_occurrences%rowtype; v_def public.chore_definitions%rowtype; v_actor uuid; v_next text; v_authorized boolean;
begin
  perform set_config('householdos.chore_mutation','rpc',true);
  select * into v_occ from public.chore_occurrences where id=p_occurrence_id for update;
  if not found then raise exception 'Occurrence not found'; end if;
  select * into v_def from public.chore_definitions where id=v_occ.definition_id;
  v_actor:=public._chore_active_membership(v_occ.household_id);
  v_authorized:=public.is_chore_assignee(p_occurrence_id) or v_actor=v_def.created_by_membership_id or public.is_household_coordinator(v_occ.household_id);
  if not v_authorized then raise exception 'Not authorized for this chore'; end if;
  v_next:=case p_action when 'start' then 'in_progress' when 'block' then 'blocked' when 'skip' then 'skipped' when 'cancel' then 'cancelled' else null end;
  if v_next is null then raise exception 'Invalid transition'; end if;
  if p_action='start' and v_occ.status not in('scheduled','reopened','blocked') then raise exception 'Cannot start from current status'; end if;
  if p_action in('skip','cancel') and v_occ.status in('completed','verified','cancelled') then raise exception 'Terminal occurrence cannot transition'; end if;
  update public.chore_occurrences set status=v_next,
    started_at=case when p_action='start' then coalesce(started_at,now()) else started_at end,
    cancelled_at=case when p_action='cancel' then now() else cancelled_at end,
    skip_reason=case when p_action='skip' then p_reason else skip_reason end,
    blocked_reason=case when p_action='block' then p_reason else blocked_reason end,
    blocked_note=case when p_action='block' then p_note else blocked_note end where id=p_occurrence_id;
  if p_action in('skip','cancel') then update public.scheduled_notification_requests set cancelled_at=now(),updated_at=now()
    where source_type='chore_occurrence' and source_id=p_occurrence_id and processed_at is null and cancelled_at is null; end if;
  perform public._chore_audit(v_occ.household_id,'chore_occurrence',p_occurrence_id,'chore.'||p_action,null,jsonb_build_object('status',v_next),p_reason);
  return p_occurrence_id;
end $$;
create or replace function public.start_chore_occurrence(p_occurrence_id uuid) returns uuid language sql security definer set search_path=public as $$select public._transition_chore_occurrence(p_occurrence_id,'start')$$;
create or replace function public.mark_chore_blocked(p_occurrence_id uuid,p_reason text,p_note text default null) returns uuid language sql security definer set search_path=public as $$select public._transition_chore_occurrence(p_occurrence_id,'block',p_reason,p_note)$$;
create or replace function public.skip_chore_occurrence(p_occurrence_id uuid,p_reason text) returns uuid language sql security definer set search_path=public as $$select public._transition_chore_occurrence(p_occurrence_id,'skip',p_reason)$$;
create or replace function public.cancel_chore_occurrence(p_occurrence_id uuid,p_reason text default null) returns uuid language sql security definer set search_path=public as $$select public._transition_chore_occurrence(p_occurrence_id,'cancel',p_reason)$$;

create or replace function public.complete_chore_occurrence(p_occurrence_id uuid,p_completion_note text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_occ public.chore_occurrences%rowtype; v_def public.chore_definitions%rowtype; v_actor uuid; v_record uuid; v_version int;
begin
  perform set_config('householdos.chore_mutation','rpc',true);
  select * into v_occ from public.chore_occurrences where id=p_occurrence_id for update;
  if not found or v_occ.status not in('scheduled','in_progress','blocked','reopened') then raise exception 'Occurrence cannot be completed'; end if;
  select * into v_def from public.chore_definitions where id=v_occ.definition_id;
  v_actor:=public._chore_active_membership(v_occ.household_id);
  if not public.is_chore_assignee(p_occurrence_id) then raise exception 'Only an assignee may complete this chore'; end if;
  select coalesce(max(version),0)+1 into v_version from public.chore_completion_records where occurrence_id=p_occurrence_id;
  insert into public.chore_completion_records(occurrence_id,household_id,completed_by_membership_id,completion_note,version)
  values(p_occurrence_id,v_occ.household_id,v_actor,nullif(trim(coalesce(p_completion_note,'')),''),v_version) returning id into v_record;
  update public.chore_occurrences set status=case when v_def.requires_verification then 'awaiting_verification' else 'completed' end,completed_at=now() where id=p_occurrence_id;
  update public.scheduled_notification_requests set cancelled_at=now(),updated_at=now()
    where source_type='chore_occurrence' and source_id=p_occurrence_id and processed_at is null and cancelled_at is null;
  perform public._chore_audit(v_occ.household_id,'chore_occurrence',p_occurrence_id,'chore.completed');
  if v_def.verifier_membership_id is not null then perform public._chore_notify(v_occ.household_id,'chore.awaiting_verification','chore_occurrence',p_occurrence_id,v_actor,array[v_def.verifier_membership_id]); end if;
  return v_record;
end $$;

create or replace function public.verify_chore_completion(p_occurrence_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_occ public.chore_occurrences%rowtype; v_def public.chore_definitions%rowtype; v_actor uuid;
begin
  perform set_config('householdos.chore_mutation','rpc',true);
  select * into v_occ from public.chore_occurrences where id=p_occurrence_id for update;
  if not found or v_occ.status<>'awaiting_verification' then raise exception 'Occurrence is not awaiting verification'; end if;
  select * into v_def from public.chore_definitions where id=v_occ.definition_id;
  v_actor:=public._chore_active_membership(v_occ.household_id);
  if v_actor is distinct from v_def.verifier_membership_id and not public.is_household_coordinator(v_occ.household_id) then raise exception 'Verifier or coordinator required'; end if;
  update public.chore_completion_records set status='verified',verified_at=now(),verified_by_membership_id=v_actor
    where id=(select id from public.chore_completion_records where occurrence_id=p_occurrence_id order by version desc limit 1);
  update public.chore_occurrences set status='verified' where id=p_occurrence_id;
  perform public._chore_audit(v_occ.household_id,'chore_occurrence',p_occurrence_id,'chore.verified');
  return p_occurrence_id;
end $$;

create or replace function public.reopen_chore_occurrence(p_occurrence_id uuid,p_reason text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_occ public.chore_occurrences%rowtype; v_actor uuid;
begin
  perform set_config('householdos.chore_mutation','rpc',true);
  select * into v_occ from public.chore_occurrences where id=p_occurrence_id for update;
  if not found or v_occ.status not in('completed','verified') then raise exception 'Only completed chores may be reopened'; end if;
  v_actor:=public._chore_active_membership(v_occ.household_id);
  if not public.is_household_coordinator(v_occ.household_id) then raise exception 'Household coordinator required'; end if;
  update public.chore_completion_records set status='reopened',reopen_reason=trim(p_reason)
    where id=(select id from public.chore_completion_records where occurrence_id=p_occurrence_id order by version desc limit 1);
  update public.chore_occurrences set status='reopened',reopen_reason=trim(p_reason),completed_at=null where id=p_occurrence_id;
  perform public._chore_audit(v_occ.household_id,'chore_occurrence',p_occurrence_id,'chore.reopened',null,null,p_reason);
  return p_occurrence_id;
end $$;

create or replace function public.create_responsibility_area(p_household_id uuid,p_name text,p_category text,p_start_date date,p_description text default null,p_handoff_expectations text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_actor uuid; v_id uuid;
begin
  perform set_config('householdos.chore_mutation','rpc',true);
  v_actor:=public._chore_active_membership(p_household_id);
  if not public.is_household_coordinator(p_household_id) then raise exception 'Household coordinator required'; end if;
  insert into public.responsibility_areas(household_id,name,description,category,start_date,handoff_expectations,created_by_membership_id)
  values(p_household_id,trim(p_name),nullif(trim(coalesce(p_description,'')),''),p_category,p_start_date,nullif(trim(coalesce(p_handoff_expectations,'')),''),v_actor)
  returning id into v_id;
  perform public._chore_audit(p_household_id,'responsibility_area',v_id,'responsibility.area_created');
  return v_id;
end $$;

create or replace function public.assign_responsibility_area(p_area_id uuid,p_membership_id uuid,p_role text default 'owner')
returns uuid language plpgsql security definer set search_path=public as $$
declare v_area public.responsibility_areas%rowtype; v_id uuid;
begin
  perform set_config('householdos.chore_mutation','rpc',true);
  select * into v_area from public.responsibility_areas where id=p_area_id for update;
  if not found then raise exception 'Responsibility area not found'; end if;
  perform public._chore_active_membership(v_area.household_id);
  if not public.is_household_coordinator(v_area.household_id) then raise exception 'Household coordinator required'; end if;
  perform public._chore_assert_member(v_area.household_id,p_membership_id);
  if p_role='owner' then update public.responsibility_assignments set status='ended',ended_at=now() where area_id=p_area_id and role='owner' and status='active'; end if;
  insert into public.responsibility_assignments(area_id,household_id,membership_id,role) values(p_area_id,v_area.household_id,p_membership_id,p_role) returning id into v_id;
  perform public._chore_audit(v_area.household_id,'responsibility_area',p_area_id,'responsibility.assigned');
  return v_id;
end $$;

create or replace function public.request_responsibility_transfer(p_area_id uuid,p_to_membership_id uuid,p_note text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_area public.responsibility_areas%rowtype; v_actor uuid; v_id uuid;
begin
  perform set_config('householdos.chore_mutation','rpc',true);
  select * into v_area from public.responsibility_areas where id=p_area_id;
  if not found then raise exception 'Responsibility area not found'; end if;
  v_actor:=public._chore_active_membership(v_area.household_id);
  if not exists(select 1 from public.responsibility_assignments where area_id=p_area_id and membership_id=v_actor and status='active')
     and not public.is_household_coordinator(v_area.household_id) then raise exception 'Active owner or coordinator required'; end if;
  perform public._chore_assert_member(v_area.household_id,p_to_membership_id);
  insert into public.responsibility_transfers(area_id,household_id,from_membership_id,to_membership_id,note)
  values(p_area_id,v_area.household_id,v_actor,p_to_membership_id,nullif(trim(coalesce(p_note,'')),'')) returning id into v_id;
  update public.responsibility_areas set status='handoff_pending' where id=p_area_id;
  perform public._chore_audit(v_area.household_id,'responsibility_transfer',v_id,'responsibility.transfer_requested');
  perform public._chore_notify(v_area.household_id,'responsibility.transfer_requested','responsibility_transfer',v_id,v_actor,array[p_to_membership_id]);
  return v_id;
end $$;

create or replace function public._resolve_responsibility_transfer(p_transfer_id uuid,p_status text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_transfer public.responsibility_transfers%rowtype; v_actor uuid;
begin
  perform set_config('householdos.chore_mutation','rpc',true);
  select * into v_transfer from public.responsibility_transfers where id=p_transfer_id for update;
  if not found or v_transfer.status<>'pending' then raise exception 'Pending transfer not found'; end if;
  v_actor:=public._chore_active_membership(v_transfer.household_id);
  if v_actor<>v_transfer.to_membership_id and not public.is_household_coordinator(v_transfer.household_id) then raise exception 'Recipient or coordinator required'; end if;
  update public.responsibility_transfers set status=p_status,resolved_at=now() where id=p_transfer_id;
  if p_status='accepted' then
    update public.responsibility_assignments set status='ended',ended_at=now() where area_id=v_transfer.area_id and status='active' and role='owner';
    insert into public.responsibility_assignments(area_id,household_id,membership_id,role) values(v_transfer.area_id,v_transfer.household_id,v_transfer.to_membership_id,'owner');
    update public.responsibility_areas set status='active' where id=v_transfer.area_id;
  else update public.responsibility_areas set status='active' where id=v_transfer.area_id; end if;
  perform public._chore_audit(v_transfer.household_id,'responsibility_transfer',p_transfer_id,'responsibility.transfer_'||p_status);
  return p_transfer_id;
end $$;
create or replace function public.accept_responsibility_transfer(p_transfer_id uuid) returns uuid language sql security definer set search_path=public as $$select public._resolve_responsibility_transfer(p_transfer_id,'accepted')$$;
create or replace function public.decline_responsibility_transfer(p_transfer_id uuid) returns uuid language sql security definer set search_path=public as $$select public._resolve_responsibility_transfer(p_transfer_id,'declined')$$;

create or replace function public._link_chore_occurrence_calendar(p_occurrence_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_occ public.chore_occurrences%rowtype; v_def public.chore_definitions%rowtype; v_event uuid;
begin
  perform set_config('householdos.calendar_mutation','rpc',true);
  perform set_config('householdos.chore_mutation','rpc',true);
  select * into v_occ from public.chore_occurrences where id=p_occurrence_id;
  if not found then return null; end if;
  select * into v_def from public.chore_definitions where id=v_occ.definition_id;
  if not v_def.show_on_calendar then
    if v_occ.calendar_event_id is not null then update public.calendar_events set status='cancelled',cancelled_at=now(),cancelled_by_membership_id=v_def.created_by_membership_id,cancellation_reason='Chore calendar display disabled' where id=v_occ.calendar_event_id and status='scheduled'; end if;
    return null;
  end if;
  if v_occ.calendar_event_id is null then
    insert into public.calendar_events(household_id,organizer_membership_id,title,description,category,visibility,status,all_day,
      starts_at,ends_at,start_date,end_date_exclusive,time_zone,calendar_uid,source_type,source_id,client_idempotency_key)
    values(v_occ.household_id,v_def.created_by_membership_id,v_def.title,v_def.description,
      case when v_def.calendar_category='chores' then 'cleaning' else 'other' end,
      case when v_def.visibility='household' then 'household' else 'participants' end,'scheduled',v_occ.all_day,
      case when not v_occ.all_day then v_occ.due_at end,case when not v_occ.all_day then v_occ.due_at+interval '30 minutes' end,
      case when v_occ.all_day then v_occ.due_date end,case when v_occ.all_day then v_occ.due_date+1 end,v_def.time_zone,
      'householdos-chore-'||v_occ.id::text||'@householdos.app','chore',v_occ.id,'chore:'||v_occ.id::text)
    returning id into v_event;
    update public.chore_occurrences set calendar_event_id=v_event where id=p_occurrence_id;
  else
    v_event:=v_occ.calendar_event_id;
    update public.calendar_events set title=v_def.title,description=v_def.description,all_day=v_occ.all_day,
      starts_at=case when not v_occ.all_day then v_occ.due_at end,ends_at=case when not v_occ.all_day then v_occ.due_at+interval '30 minutes' end,
      start_date=case when v_occ.all_day then v_occ.due_date end,end_date_exclusive=case when v_occ.all_day then v_occ.due_date+1 end,
      sequence=sequence+1 where id=v_event;
  end if;
  return v_event;
end $$;

create or replace function public._reconcile_chore_reminders(p_occurrence_id uuid)
returns int language plpgsql security definer set search_path=public as $$
declare v_occ public.chore_occurrences%rowtype; v_def public.chore_definitions%rowtype; v_offset int; v_user uuid; v_fire timestamptz; v_count int:=0;
begin
  select * into v_occ from public.chore_occurrences where id=p_occurrence_id;
  if not found then return 0; end if;
  select * into v_def from public.chore_definitions where id=v_occ.definition_id;
  update public.scheduled_notification_requests set cancelled_at=now(),updated_at=now()
    where source_type='chore_occurrence' and source_id=p_occurrence_id and processed_at is null and cancelled_at is null;
  if v_occ.status not in('scheduled','in_progress','reopened') or v_def.status<>'active' then return 0; end if;
  foreach v_offset in array v_def.reminder_offsets loop
    v_fire:=v_occ.due_at-make_interval(mins=>v_offset);
    if v_fire<now()-interval '1 minute' then continue; end if;
    for v_user in select distinct m.user_id from public.chore_assignments a join public.household_memberships m on m.id=a.membership_id
      where a.occurrence_id=p_occurrence_id and a.status<>'released' loop
      perform public._create_scheduled_notification_request('chore_occurrence',p_occurrence_id,v_user,'chore.reminder',v_fire,v_def.time_zone,
        'chore_occurrence:'||p_occurrence_id::text||':'||v_user::text||':'||v_offset::text,
        jsonb_build_object('source_type','chore_occurrence','source_id',p_occurrence_id,'title','Upcoming chore','body','Open HouseholdOS to review it.',
          'action_href','/app/'||v_occ.household_id::text||'/chores/'||p_occurrence_id::text));
      v_count:=v_count+1;
    end loop;
  end loop;
  return v_count;
end $$;

create or replace function public.claim_chore_horizon_extensions(p_limit int default 25)
returns table(definition_id uuid) language plpgsql security definer set search_path=public as $$
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'claim_chore_horizon_extensions requires service_role'; end if;
  return query select d.id from public.chore_definitions d where d.rrule is not null and d.status='active'
    and (d.materialized_through is null or d.materialized_through<now()+interval '60 days')
    order by d.materialized_through asc nulls first,d.created_at for update of d skip locked limit least(greatest(coalesce(p_limit,25),1),200);
end $$;

-- Chore-linked calendar rows are owned by chore RPCs, never generic calendar RPCs.
create or replace function public.enforce_chore_calendar_ownership() returns trigger language plpgsql as $$
begin
  if coalesce(old.source_type,new.source_type)='chore'
     and current_setting('householdos.chore_mutation',true) is distinct from 'rpc'
     and current_setting('householdos.privileged_mutation',true) is distinct from 'on'
  then raise exception 'Chore calendar events must be changed through chore RPCs'; end if;
  return coalesce(new,old);
end $$;
create trigger calendar_events_chore_owned before update or delete on public.calendar_events for each row execute function public.enforce_chore_calendar_ownership();

-- Public RPC privileges: internal helpers remain private.
do $$
declare v_function regprocedure;
begin
  for v_function in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname = any(array[
        '_chore_assert_member','_chore_audit','_chore_notify',
        '_set_chore_definition_status','_resolve_chore_reassignment',
        '_transition_chore_occurrence','_resolve_responsibility_transfer',
        '_link_chore_occurrence_calendar','_reconcile_chore_reminders',
        'create_chore_rotation','update_chore_rotation','update_chore_rotation_members',
        'create_chore_definition','create_one_time_chore','update_chore_definition',
        'pause_chore_definition','resume_chore_definition','end_chore_definition',
        'materialize_chore_occurrences','assign_chore_occurrence','claim_chore_occurrence',
        'request_chore_reassignment','approve_chore_reassignment','decline_chore_reassignment',
        'start_chore_occurrence','mark_chore_blocked','skip_chore_occurrence',
        'cancel_chore_occurrence','complete_chore_occurrence','verify_chore_completion',
        'reopen_chore_occurrence','create_responsibility_area','assign_responsibility_area',
        'request_responsibility_transfer','accept_responsibility_transfer',
        'decline_responsibility_transfer','claim_chore_horizon_extensions'
      ])
  loop
    execute format('revoke all on function %s from public, anon', v_function);
  end loop;
end $$;

grant execute on function public.create_chore_rotation(uuid,text,text,uuid,uuid[]) to authenticated;
grant execute on function public.update_chore_rotation(uuid,text,text,uuid,boolean,boolean) to authenticated;
grant execute on function public.update_chore_rotation_members(uuid,uuid[]) to authenticated;
grant execute on function public.create_chore_definition(uuid,text,text,date,text,boolean,int,text,text,text,date,int,int,boolean,uuid,boolean,text,uuid,uuid,int[],boolean) to authenticated;
grant execute on function public.create_one_time_chore(uuid,text,text,timestamptz,uuid[],text,text,boolean,date,int,boolean,uuid,boolean,uuid,int[]) to authenticated;
grant execute on function public.update_chore_definition(uuid,jsonb) to authenticated;
grant execute on function public.pause_chore_definition(uuid),public.resume_chore_definition(uuid),public.end_chore_definition(uuid) to authenticated;
grant execute on function public.materialize_chore_occurrences(uuid,jsonb) to authenticated,service_role;
grant execute on function public.claim_chore_occurrence(uuid),public.assign_chore_occurrence(uuid,uuid,text) to authenticated;
grant execute on function public.request_chore_reassignment(uuid,text,uuid,timestamptz),public.approve_chore_reassignment(uuid,text),public.decline_chore_reassignment(uuid,text) to authenticated;
grant execute on function public.start_chore_occurrence(uuid),public.mark_chore_blocked(uuid,text,text),public.skip_chore_occurrence(uuid,text),public.cancel_chore_occurrence(uuid,text) to authenticated;
grant execute on function public.complete_chore_occurrence(uuid,text),public.verify_chore_completion(uuid),public.reopen_chore_occurrence(uuid,text) to authenticated;
grant execute on function public.create_responsibility_area(uuid,text,text,date,text,text),public.assign_responsibility_area(uuid,uuid,text) to authenticated;
grant execute on function public.request_responsibility_transfer(uuid,uuid,text),public.accept_responsibility_transfer(uuid),public.decline_responsibility_transfer(uuid) to authenticated;
revoke all on function public.claim_chore_horizon_extensions(int) from public,anon,authenticated;
grant execute on function public.claim_chore_horizon_extensions(int) to service_role;
grant execute on function public._reconcile_chore_reminders(uuid),public._link_chore_occurrence_calendar(uuid) to service_role;
