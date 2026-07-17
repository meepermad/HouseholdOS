-- Phase 7B: maintenance integrations (inventory, expense, vendors, evidence, actions)

create or replace function public.link_maintenance_inventory(
  p_request_id uuid,
  p_inventory_item_id uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_req public.maintenance_requests%rowtype; v_actor uuid;
begin
  perform set_config('householdos.maintenance_mutation', 'rpc', true);
  select * into v_req from public.maintenance_requests where id = p_request_id for update;
  if not found then raise exception 'Maintenance request not found'; end if;
  v_actor := public._maintenance_active_membership(v_req.household_id);
  if not exists (
    select 1 from public.inventory_items i
    where i.id = p_inventory_item_id and i.household_id = v_req.household_id
  ) then raise exception 'Inventory item must belong to this household'; end if;
  insert into public.maintenance_inventory_links(
    request_id, household_id, inventory_item_id, created_by_membership_id
  ) values (p_request_id, v_req.household_id, p_inventory_item_id, v_actor)
  on conflict (request_id, inventory_item_id) do update set unlinked_at = null;
  update public.maintenance_requests set inventory_item_id = coalesce(inventory_item_id, p_inventory_item_id)
  where id = p_request_id;
  return p_request_id;
end $$;

create or replace function public.record_maintenance_condition_change(
  p_request_id uuid,
  p_inventory_item_id uuid,
  p_new_condition text,
  p_confirm boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_req public.maintenance_requests%rowtype; v_actor uuid;
begin
  perform set_config('householdos.maintenance_mutation', 'rpc', true);
  select * into v_req from public.maintenance_requests where id = p_request_id;
  if not found then raise exception 'Maintenance request not found'; end if;
  v_actor := public._maintenance_active_membership(v_req.household_id);
  if not coalesce(p_confirm, false) then
    raise exception 'Condition change requires explicit confirmation';
  end if;
  if not exists (
    select 1 from public.inventory_items i
    where i.id = p_inventory_item_id and i.household_id = v_req.household_id
  ) then raise exception 'Inventory item must belong to this household'; end if;
  perform public.change_inventory_condition(p_inventory_item_id, p_new_condition);
  perform public._maintenance_append_event(
    p_request_id, v_req.household_id, v_actor, 'condition_changed', null,
    jsonb_build_object('inventory_item_id', p_inventory_item_id, 'condition', p_new_condition)
  );
  return p_request_id;
end $$;

create or replace function public.link_maintenance_expense(
  p_request_id uuid,
  p_expense_id uuid,
  p_link_kind text default 'repair'
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_req public.maintenance_requests%rowtype; v_actor uuid;
begin
  perform set_config('householdos.maintenance_mutation', 'rpc', true);
  select * into v_req from public.maintenance_requests where id = p_request_id;
  if not found then raise exception 'Maintenance request not found'; end if;
  v_actor := public._maintenance_active_membership(v_req.household_id);
  if not exists (
    select 1 from public.expenses e
    where e.id = p_expense_id and e.household_id = v_req.household_id
  ) then raise exception 'Expense must belong to this household'; end if;
  insert into public.maintenance_expense_links(
    request_id, household_id, expense_id, link_kind, created_by_membership_id
  ) values (p_request_id, v_req.household_id, p_expense_id, coalesce(p_link_kind,'repair'), v_actor);
  perform public._maintenance_append_event(
    p_request_id, v_req.household_id, v_actor, 'expense_linked', null,
    jsonb_build_object('expense_id', p_expense_id, 'link_kind', p_link_kind)
  );
  perform public._maintenance_audit(
    v_req.household_id, 'maintenance_request', p_request_id, 'maintenance.expense_linked',
    null, jsonb_build_object('linked', true)
  );
  return p_request_id;
end $$;

create or replace function public.create_maintenance_action(
  p_request_id uuid,
  p_title text,
  p_description text default null,
  p_assignee_membership_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_req public.maintenance_requests%rowtype; v_actor uuid; v_id uuid;
begin
  perform set_config('householdos.maintenance_mutation', 'rpc', true);
  select * into v_req from public.maintenance_requests where id = p_request_id;
  if not found then raise exception 'Maintenance request not found'; end if;
  v_actor := public._maintenance_active_membership(v_req.household_id);
  if p_assignee_membership_id is not null and not exists (
    select 1 from public.household_memberships m
    where m.id = p_assignee_membership_id and m.household_id = v_req.household_id and m.status = 'active'
  ) then raise exception 'Assignee must be an active household member'; end if;
  insert into public.maintenance_actions(
    request_id, household_id, title, description, assignee_membership_id, created_by_membership_id
  ) values (
    p_request_id, v_req.household_id, trim(p_title),
    nullif(trim(coalesce(p_description,'')),''), p_assignee_membership_id, v_actor
  ) returning id into v_id;
  return v_id;
end $$;

create or replace function public.link_maintenance_chore(
  p_request_id uuid,
  p_chore_occurrence_id uuid default null,
  p_chore_definition_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_req public.maintenance_requests%rowtype; v_actor uuid; v_id uuid;
begin
  perform set_config('householdos.maintenance_mutation', 'rpc', true);
  select * into v_req from public.maintenance_requests where id = p_request_id;
  if not found then raise exception 'Maintenance request not found'; end if;
  v_actor := public._maintenance_active_membership(v_req.household_id);
  if p_chore_occurrence_id is not null and not exists (
    select 1 from public.chore_occurrences c
    where c.id = p_chore_occurrence_id and c.household_id = v_req.household_id
  ) then raise exception 'Chore must belong to this household'; end if;
  if p_chore_definition_id is not null and not exists (
    select 1 from public.chore_definitions d
    where d.id = p_chore_definition_id and d.household_id = v_req.household_id
  ) then raise exception 'Chore definition must belong to this household'; end if;
  insert into public.maintenance_chore_links(
    request_id, household_id, chore_occurrence_id, chore_definition_id, created_by_membership_id
  ) values (
    p_request_id, v_req.household_id, p_chore_occurrence_id, p_chore_definition_id, v_actor
  ) returning id into v_id;
  return v_id;
end $$;

create or replace function public.create_maintenance_contact(
  p_household_id uuid,
  p_display_name text,
  p_contact_type text,
  p_organization text default null,
  p_phone text default null,
  p_email text default null,
  p_website text default null,
  p_notes text default null,
  p_preferred boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_actor uuid; v_id uuid;
begin
  perform set_config('householdos.maintenance_mutation', 'rpc', true);
  v_actor := public._maintenance_active_membership(p_household_id);
  insert into public.maintenance_external_contacts(
    household_id, display_name, contact_type, organization, phone, email, website, notes,
    preferred, created_by_membership_id
  ) values (
    p_household_id, trim(p_display_name), p_contact_type,
    nullif(trim(coalesce(p_organization,'')),''),
    nullif(trim(coalesce(p_phone,'')),''),
    nullif(trim(coalesce(p_email,'')),''),
    nullif(trim(coalesce(p_website,'')),''),
    nullif(trim(coalesce(p_notes,'')),''),
    coalesce(p_preferred,false), v_actor
  ) returning id into v_id;
  return v_id;
end $$;

create or replace function public.record_maintenance_contact_event(
  p_request_id uuid,
  p_contact_id uuid,
  p_event_kind text,
  p_reference_number text default null,
  p_notes text default null,
  p_follow_up_at timestamptz default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_req public.maintenance_requests%rowtype; v_actor uuid; v_id uuid;
begin
  perform set_config('householdos.maintenance_mutation', 'rpc', true);
  select * into v_req from public.maintenance_requests where id = p_request_id;
  if not found then raise exception 'Maintenance request not found'; end if;
  v_actor := public._maintenance_active_membership(v_req.household_id);
  if not exists (
    select 1 from public.maintenance_external_contacts c
    where c.id = p_contact_id and c.household_id = v_req.household_id
  ) then raise exception 'Contact must belong to this household'; end if;
  insert into public.maintenance_contact_events(
    request_id, household_id, contact_id, event_kind, reference_number, notes,
    follow_up_at, recorded_by_membership_id
  ) values (
    p_request_id, v_req.household_id, p_contact_id, p_event_kind,
    nullif(trim(coalesce(p_reference_number,'')),''),
    nullif(trim(coalesce(p_notes,'')),''),
    p_follow_up_at, v_actor
  ) returning id into v_id;
  update public.maintenance_external_contacts set last_contacted_at = now() where id = p_contact_id;
  perform public._maintenance_append_event(
    p_request_id, v_req.household_id, v_actor, 'contact_attempted', p_notes,
    jsonb_build_object('event_kind', p_event_kind)
  );
  return v_id;
end $$;

create or replace function public.record_maintenance_quote(
  p_request_id uuid,
  p_amount_cents int,
  p_contact_id uuid default null,
  p_expires_at timestamptz default null,
  p_notes text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_req public.maintenance_requests%rowtype; v_actor uuid; v_id uuid;
begin
  perform set_config('householdos.maintenance_mutation', 'rpc', true);
  select * into v_req from public.maintenance_requests where id = p_request_id;
  if not found then raise exception 'Maintenance request not found'; end if;
  v_actor := public._maintenance_active_membership(v_req.household_id);
  insert into public.maintenance_quotes(
    request_id, household_id, contact_id, amount_cents, expires_at, notes, recorded_by_membership_id
  ) values (
    p_request_id, v_req.household_id, p_contact_id, p_amount_cents, p_expires_at,
    nullif(trim(coalesce(p_notes,'')),''), v_actor
  ) returning id into v_id;
  update public.maintenance_requests set quoted_cost_cents = p_amount_cents where id = p_request_id;
  return v_id;
end $$;

create or replace function public.add_maintenance_attachment(
  p_request_id uuid,
  p_storage_path text,
  p_mime_type text,
  p_file_name text,
  p_size_bytes int
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_req public.maintenance_requests%rowtype;
  v_actor uuid;
  v_id uuid;
  v_count int;
begin
  perform set_config('householdos.maintenance_mutation', 'rpc', true);
  select * into v_req from public.maintenance_requests where id = p_request_id;
  if not found then raise exception 'Maintenance request not found'; end if;
  if not public.can_view_maintenance_request(p_request_id) then raise exception 'Not authorized'; end if;
  v_actor := public._maintenance_active_membership(v_req.household_id);
  if p_mime_type not in ('image/jpeg','image/png','image/webp','application/pdf') then
    raise exception 'Unsupported evidence MIME type';
  end if;
  if p_size_bytes is null or p_size_bytes <= 0 or p_size_bytes > 8388608 then
    raise exception 'Evidence file size out of bounds';
  end if;
  select count(*)::int into v_count from public.maintenance_attachments
  where request_id = p_request_id and deleted_at is null;
  if v_count >= 12 then raise exception 'Evidence count limit reached'; end if;
  if p_storage_path not like (v_req.household_id::text || '/' || p_request_id::text || '/%') then
    raise exception 'Storage path must be household-scoped';
  end if;

  insert into public.maintenance_attachments(
    request_id, household_id, storage_path, mime_type, file_name, size_bytes, uploaded_by_membership_id
  ) values (
    p_request_id, v_req.household_id, p_storage_path, p_mime_type, trim(p_file_name), p_size_bytes, v_actor
  ) returning id into v_id;

  perform public._maintenance_append_event(
    p_request_id, v_req.household_id, v_actor, 'evidence_added', null,
    jsonb_build_object('attachment_id', v_id, 'mime_type', p_mime_type)
  );
  perform public._maintenance_audit(
    v_req.household_id, 'maintenance_request', p_request_id, 'maintenance.evidence_added',
    null, jsonb_build_object('attachment_id', v_id)
  );
  perform public._maintenance_notify(
    v_req.household_id, 'maintenance.evidence_added', p_request_id, v_actor,
    array[coalesce(v_req.primary_coordinator_membership_id, v_req.reporter_membership_id)],
    'Evidence added',
    'Evidence was added to a maintenance issue.'
  );
  return v_id;
end $$;

create or replace function public.remove_maintenance_attachment(p_attachment_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_att public.maintenance_attachments%rowtype; v_actor uuid;
begin
  perform set_config('householdos.maintenance_mutation', 'rpc', true);
  select * into v_att from public.maintenance_attachments where id = p_attachment_id for update;
  if not found then raise exception 'Attachment not found'; end if;
  v_actor := public._maintenance_active_membership(v_att.household_id);
  if v_att.uploaded_by_membership_id <> v_actor and not public.is_household_coordinator(v_att.household_id) then
    raise exception 'Not authorized to remove attachment';
  end if;
  update public.maintenance_attachments set deleted_at = now() where id = p_attachment_id;
  perform public._maintenance_append_event(
    v_att.request_id, v_att.household_id, v_actor, 'evidence_removed', null,
    jsonb_build_object('attachment_id', p_attachment_id)
  );
  return p_attachment_id;
end $$;

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
    jsonb_build_object('calendar_event_id', v_event_id)
  );
  perform public._maintenance_audit(
    v_req.household_id, 'maintenance_request', p_request_id, 'maintenance.appointment_scheduled',
    null, jsonb_build_object('calendar_event_id', v_event_id)
  );
  perform public._maintenance_notify(
    v_req.household_id, 'maintenance.appointment_scheduled', p_request_id, v_actor,
    array[coalesce(v_req.primary_coordinator_membership_id, v_req.reporter_membership_id)],
    'Maintenance appointment',
    'A maintenance appointment was scheduled.'
  );
  return v_event_id;
end $$;

create or replace function public.cancel_maintenance_appointment(p_calendar_link_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_link public.maintenance_calendar_links%rowtype; v_actor uuid;
begin
  perform set_config('householdos.maintenance_mutation', 'rpc', true);
  perform set_config('householdos.calendar_mutation', 'rpc', true);
  select * into v_link from public.maintenance_calendar_links where id = p_calendar_link_id for update;
  if not found then raise exception 'Appointment link not found'; end if;
  v_actor := public._maintenance_active_membership(v_link.household_id);
  update public.maintenance_calendar_links set cancelled_at = now() where id = p_calendar_link_id;
  update public.calendar_events
  set cancelled_at = now(), status = 'cancelled', cancelled_by_membership_id = v_actor
  where id = v_link.calendar_event_id and cancelled_at is null;
  perform public._maintenance_append_event(
    v_link.request_id, v_link.household_id, v_actor, 'appointment_cancelled', null,
    jsonb_build_object('calendar_event_id', v_link.calendar_event_id)
  );
  -- Cancelling appointment does not cancel the maintenance issue
  return p_calendar_link_id;
end $$;

-- Grants
grant execute on function public.create_maintenance_request(uuid,text,text,text,text,text,uuid,uuid,date,boolean,boolean,text,text[],uuid,boolean,uuid[]) to authenticated;
grant execute on function public.triage_maintenance_request(uuid,text,uuid,text) to authenticated;
grant execute on function public.assign_maintenance_request(uuid,uuid,boolean) to authenticated;
grant execute on function public.claim_maintenance_request(uuid) to authenticated;
grant execute on function public.change_maintenance_waiting_status(uuid,text) to authenticated;
grant execute on function public.add_maintenance_comment(uuid,text) to authenticated;
grant execute on function public.record_maintenance_mitigation(uuid,text) to authenticated;
grant execute on function public.resolve_maintenance_request(uuid,text,text) to authenticated;
grant execute on function public.close_maintenance_request(uuid) to authenticated;
grant execute on function public.reopen_maintenance_request(uuid,text) to authenticated;
grant execute on function public.cancel_maintenance_request(uuid,text) to authenticated;
grant execute on function public.link_maintenance_inventory(uuid,uuid) to authenticated;
grant execute on function public.record_maintenance_condition_change(uuid,uuid,text,boolean) to authenticated;
grant execute on function public.link_maintenance_expense(uuid,uuid,text) to authenticated;
grant execute on function public.create_maintenance_action(uuid,text,text,uuid) to authenticated;
grant execute on function public.link_maintenance_chore(uuid,uuid,uuid) to authenticated;
grant execute on function public.create_maintenance_contact(uuid,text,text,text,text,text,text,text,boolean) to authenticated;
grant execute on function public.record_maintenance_contact_event(uuid,uuid,text,text,text,timestamptz) to authenticated;
grant execute on function public.record_maintenance_quote(uuid,int,uuid,timestamptz,text) to authenticated;
grant execute on function public.add_maintenance_attachment(uuid,text,text,text,int) to authenticated;
grant execute on function public.remove_maintenance_attachment(uuid) to authenticated;
grant execute on function public.schedule_maintenance_appointment(uuid,text,timestamptz,timestamptz,text,text,boolean) to authenticated;
grant execute on function public.cancel_maintenance_appointment(uuid) to authenticated;
