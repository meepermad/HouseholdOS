-- Phase 8: household transition workflows + attachment RPCs

create or replace function public._transition_append_event(
  p_workflow_id uuid, p_household_id uuid, p_actor uuid,
  p_event_type text, p_body text default null, p_payload jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.household_transition_events(
    workflow_id, household_id, event_type, actor_membership_id, body, payload
  ) values (
    p_workflow_id, p_household_id, p_event_type, p_actor,
    nullif(trim(coalesce(p_body,'')),''), coalesce(p_payload, '{}'::jsonb)
  );
end $$;
revoke all on function public._transition_append_event(uuid,uuid,uuid,text,text,jsonb) from public, anon;

create or replace function public._transition_notify(
  p_household_id uuid, p_event_type text, p_workflow_id uuid,
  p_actor_membership_id uuid, p_memberships uuid[], p_title text, p_body text
) returns void language plpgsql security definer set search_path = public as $$
declare v_users uuid[];
begin
  select array_agg(distinct m.user_id) into v_users from public.household_memberships m
  where m.id = any(coalesce(p_memberships, '{}'::uuid[]))
    and m.status = 'active' and m.user_id <> auth.uid();
  if cardinality(coalesce(v_users, '{}'::uuid[])) > 0 then
    perform public._emit_notification_event(
      p_household_id, p_event_type, 'household_transition', p_workflow_id,
      p_actor_membership_id, '{}'::jsonb,
      p_event_type || ':' || p_workflow_id::text || ':' || extract(epoch from clock_timestamp())::bigint::text,
      v_users, p_title, p_body,
      '/app/' || p_household_id::text || '/governance/transitions/' || p_workflow_id::text
    );
  end if;
end $$;
revoke all on function public._transition_notify(uuid,text,uuid,uuid,uuid[],text,text) from public, anon;

create or replace function public._seed_transition_tasks(
  p_workflow_id uuid, p_household_id uuid, p_type text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_type = 'move_in' then
    insert into public.household_transition_tasks(
      workflow_id, household_id, task_key, title, description, position, requires_explicit_confirmation
    ) values
      (p_workflow_id, p_household_id, 'invitation_acceptance', 'Invitation acceptance', 'Confirm the member accepted the household invitation.', 0, false),
      (p_workflow_id, p_household_id, 'planned_date_confirm', 'Confirm planned move-in date', null, 1, false),
      (p_workflow_id, p_household_id, 'room_assignment', 'Room or space assignment', null, 2, false),
      (p_workflow_id, p_household_id, 'agreement_review', 'Agreement review', 'Review required household agreements.', 3, false),
      (p_workflow_id, p_household_id, 'initial_responsibilities', 'Initial responsibilities', null, 4, false),
      (p_workflow_id, p_household_id, 'shared_item_contributions', 'Shared item contributions', null, 5, false),
      (p_workflow_id, p_household_id, 'key_access', 'Key and access checklist', null, 6, false),
      (p_workflow_id, p_household_id, 'utility_billing', 'Utility and billing setup', null, 7, true),
      (p_workflow_id, p_household_id, 'emergency_contact', 'Emergency contact information', 'Private field — share only with granted members.', 8, false),
      (p_workflow_id, p_household_id, 'inventory_condition', 'Initial inventory condition review', null, 9, false),
      (p_workflow_id, p_household_id, 'financial_obligations_review', 'Initial financial obligations', 'Does not create expenses automatically. Confirm separately in Money.', 10, true);
  else
    insert into public.household_transition_tasks(
      workflow_id, household_id, task_key, title, description, position, requires_explicit_confirmation
    ) values
      (p_workflow_id, p_household_id, 'planned_date', 'Confirm planned move-out date', null, 0, false),
      (p_workflow_id, p_household_id, 'notice_date', 'Record notice date', null, 1, false),
      (p_workflow_id, p_household_id, 'transfer_responsibilities', 'Transfer responsibilities', null, 2, false),
      (p_workflow_id, p_household_id, 'final_cleaning', 'Final chore and cleaning checklist', null, 3, false),
      (p_workflow_id, p_household_id, 'inventory_return', 'Inventory return or ownership transfer', 'Confirm changes in Inventory; this task only tracks discussion.', 4, true),
      (p_workflow_id, p_household_id, 'key_return', 'Key and access return', null, 5, false),
      (p_workflow_id, p_household_id, 'expense_review', 'Expense and reimbursement review', null, 6, true),
      (p_workflow_id, p_household_id, 'outstanding_obligations', 'Outstanding obligation summary', 'Organizes discussion only; does not declare debt valid.', 7, true),
      (p_workflow_id, p_household_id, 'damage_review', 'Damage and maintenance review', 'Link maintenance evidence; does not assign legal responsibility.', 8, true),
      (p_workflow_id, p_household_id, 'deposit_discussion', 'Security-deposit discussion record', 'HouseholdOS does not authorize deposit deductions.', 9, true),
      (p_workflow_id, p_household_id, 'forwarding_info', 'Forwarding information', 'Private field — share only with granted members.', 10, false),
      (p_workflow_id, p_household_id, 'document_export', 'Document export for departing member', null, 11, false),
      (p_workflow_id, p_household_id, 'membership_removal_scheduling', 'Schedule membership removal', 'Creating this workflow does not remove membership.', 12, true);
  end if;
end $$;
revoke all on function public._seed_transition_tasks(uuid,uuid,text) from public, anon;

create or replace function public.create_household_transition(
  p_household_id uuid,
  p_workflow_type text,
  p_subject_membership_id uuid,
  p_planned_date date default null,
  p_notice_date date default null,
  p_room_assignment text default null,
  p_coordinator_membership_id uuid default null,
  p_visibility text default 'participants',
  p_linked_document_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid; v_id uuid; v_targets uuid[];
begin
  perform set_config('householdos.governance_mutation', 'rpc', true);
  v_actor := public._governance_active_membership(p_household_id);
  if not public.is_household_coordinator(p_household_id)
     and p_subject_membership_id <> v_actor then
    raise exception 'Only a household coordinator may create a transition for another member';
  end if;
  if p_workflow_type not in ('move_in','move_out') then
    raise exception 'Invalid workflow type';
  end if;
  if not exists (
    select 1 from public.household_memberships m
    where m.id = p_subject_membership_id and m.household_id = p_household_id
  ) then raise exception 'Subject must belong to this household'; end if;

  insert into public.household_transition_workflows(
    household_id, workflow_type, status, subject_membership_id,
    coordinator_membership_id, planned_date, notice_date, room_assignment,
    linked_document_id, visibility, created_by_membership_id
  ) values (
    p_household_id, p_workflow_type, 'draft', p_subject_membership_id,
    p_coordinator_membership_id, p_planned_date, p_notice_date,
    nullif(trim(coalesce(p_room_assignment,'')),''),
    p_linked_document_id, coalesce(nullif(p_visibility,''), 'participants'), v_actor
  ) returning id into v_id;

  perform public._seed_transition_tasks(v_id, p_household_id, p_workflow_type);
  perform public._transition_append_event(v_id, p_household_id, v_actor, 'created', null,
    jsonb_build_object('workflow_type', p_workflow_type));
  perform public._governance_audit(
    p_household_id, 'household_transition', v_id, 'governance.transition_created',
    null, jsonb_build_object('type', p_workflow_type)
  );

  v_targets := array_remove(array[p_subject_membership_id, p_coordinator_membership_id, v_actor], null);
  perform public._transition_notify(
    p_household_id,
    case when p_workflow_type = 'move_in' then 'governance.move_in_created' else 'governance.move_out_created' end,
    v_id, v_actor, v_targets,
    case when p_workflow_type = 'move_in' then 'Move-in workflow created' else 'Move-out workflow created' end,
    'A household transition checklist is ready for follow-up.'
  );
  return v_id;
end $$;

create or replace function public.advance_household_transition(
  p_workflow_id uuid,
  p_next_status text,
  p_notes text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_wf public.household_transition_workflows%rowtype;
  v_actor uuid;
begin
  perform set_config('householdos.governance_mutation', 'rpc', true);
  select * into v_wf from public.household_transition_workflows where id = p_workflow_id for update;
  if not found then raise exception 'Transition workflow not found'; end if;
  v_actor := public._governance_active_membership(v_wf.household_id);
  if not public.can_manage_transition_workflow(p_workflow_id) then
    raise exception 'Not allowed to advance this transition';
  end if;

  if not (
    (v_wf.status = 'draft' and p_next_status = 'in_progress')
    or (v_wf.status = 'in_progress' and p_next_status in ('blocked','ready_to_complete'))
    or (v_wf.status = 'blocked' and p_next_status = 'in_progress')
    or (p_next_status = 'cancelled' and v_wf.status not in ('completed','cancelled'))
  ) then
    raise exception 'Invalid transition status change: % -> %', v_wf.status, p_next_status;
  end if;
  if p_next_status = 'completed' then
    raise exception 'Use complete_household_transition to finish a workflow';
  end if;

  update public.household_transition_workflows set
    status = p_next_status,
    cancelled_at = case when p_next_status = 'cancelled' then now() else cancelled_at end,
    completion_notes = coalesce(nullif(trim(coalesce(p_notes,'')),''), completion_notes)
  where id = p_workflow_id;

  perform public._transition_append_event(
    p_workflow_id, v_wf.household_id, v_actor,
    case when p_next_status = 'cancelled' then 'cancelled'
         when p_next_status = 'blocked' then 'blocked'
         when v_wf.status = 'blocked' then 'unblocked'
         else 'advanced' end,
    p_notes, jsonb_build_object('from', v_wf.status, 'to', p_next_status)
  );
  return p_workflow_id;
end $$;

create or replace function public.complete_household_transition_task(
  p_task_id uuid,
  p_note text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_task public.household_transition_tasks%rowtype;
  v_actor uuid;
begin
  perform set_config('householdos.governance_mutation', 'rpc', true);
  select * into v_task from public.household_transition_tasks where id = p_task_id for update;
  if not found then raise exception 'Transition task not found'; end if;
  v_actor := public._governance_active_membership(v_task.household_id);
  if not (
    public.can_manage_transition_workflow(v_task.workflow_id)
    or v_task.assignee_membership_id = v_actor
  ) then
    raise exception 'Not allowed to complete this task';
  end if;
  if v_task.requires_explicit_confirmation
     and nullif(trim(coalesce(p_note,'')),'') is null then
    raise exception 'This task requires an explicit confirmation note';
  end if;

  update public.household_transition_tasks set
    status = 'done',
    completed_at = now(),
    completed_by_membership_id = v_actor,
    description = case
      when p_note is not null then coalesce(description || E'\n', '') || 'Confirmed: ' || trim(p_note)
      else description
    end
  where id = p_task_id;

  perform public._transition_append_event(
    v_task.workflow_id, v_task.household_id, v_actor, 'task_completed', p_note,
    jsonb_build_object('task_id', p_task_id, 'task_key', v_task.task_key)
  );
  perform public._transition_notify(
    v_task.household_id, 'governance.transition_task_assigned', v_task.workflow_id, v_actor,
    array(
      select w.subject_membership_id from public.household_transition_workflows w where w.id = v_task.workflow_id
    ),
    'Transition task completed',
    'A household transition checklist item was completed.'
  );
  return p_task_id;
end $$;

create or replace function public.complete_household_transition(
  p_workflow_id uuid,
  p_notes text default null,
  p_schedule_membership_removal boolean default false,
  p_removal_at timestamptz default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_wf public.household_transition_workflows%rowtype;
  v_actor uuid; v_open int;
begin
  perform set_config('householdos.governance_mutation', 'rpc', true);
  select * into v_wf from public.household_transition_workflows where id = p_workflow_id for update;
  if not found then raise exception 'Transition workflow not found'; end if;
  v_actor := public._governance_active_membership(v_wf.household_id);
  if not public.is_household_coordinator(v_wf.household_id) then
    raise exception 'Only a household coordinator may complete a transition workflow';
  end if;
  if v_wf.status not in ('in_progress','ready_to_complete') then
    raise exception 'Workflow is not ready to complete';
  end if;

  select count(*) into v_open from public.household_transition_tasks
  where workflow_id = p_workflow_id
    and status in ('open','in_progress','blocked')
    and requires_explicit_confirmation;

  if v_open > 0 then
    raise exception 'Complete or skip all confirmation-required tasks before finishing';
  end if;

  update public.household_transition_workflows set
    status = 'completed',
    completed_at = now(),
    completion_notes = nullif(trim(coalesce(p_notes,'')),''),
    membership_removal_scheduled_at = case
      when coalesce(p_schedule_membership_removal, false)
        then coalesce(p_removal_at, now())
      else membership_removal_scheduled_at
    end
  where id = p_workflow_id;

  -- Never remove membership here — only schedule a marker for an authorized follow-up
  perform public._transition_append_event(
    p_workflow_id, v_wf.household_id, v_actor, 'completed', p_notes,
    jsonb_build_object(
      'membership_removal_scheduled', coalesce(p_schedule_membership_removal, false),
      'membership_auto_removed', false
    )
  );
  if coalesce(p_schedule_membership_removal, false) then
    perform public._transition_append_event(
      p_workflow_id, v_wf.household_id, v_actor, 'membership_removal_scheduled', null,
      jsonb_build_object('removal_at', coalesce(p_removal_at, now()))
    );
  end if;
  perform public._governance_audit(
    v_wf.household_id, 'household_transition', p_workflow_id, 'governance.transition_completed'
  );
  perform public._transition_notify(
    v_wf.household_id, 'governance.transition_completed', p_workflow_id, v_actor,
    array[v_wf.subject_membership_id, v_wf.coordinator_membership_id, v_wf.created_by_membership_id],
    'Transition completed',
    'A household move-in or move-out workflow was marked complete.'
  );
  return p_workflow_id;
end $$;

create or replace function public.cancel_household_transition(
  p_workflow_id uuid,
  p_reason text default null
) returns uuid language plpgsql security definer set search_path = public as $$
begin
  return public.advance_household_transition(p_workflow_id, 'cancelled', p_reason);
end $$;

create or replace function public.upsert_transition_private_field(
  p_workflow_id uuid,
  p_field_kind text,
  p_value_text text,
  p_label text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_wf public.household_transition_workflows%rowtype;
  v_actor uuid; v_id uuid;
begin
  perform set_config('householdos.governance_mutation', 'rpc', true);
  select * into v_wf from public.household_transition_workflows where id = p_workflow_id for update;
  if not found then raise exception 'Transition workflow not found'; end if;
  v_actor := public._governance_active_membership(v_wf.household_id);
  -- Only the subject (owner) may write their private fields by default
  if v_wf.subject_membership_id <> v_actor then
    raise exception 'Only the transition subject may set private personal fields';
  end if;

  insert into public.household_transition_private_fields(
    workflow_id, household_id, owner_membership_id, field_kind, label, value_text
  ) values (
    p_workflow_id, v_wf.household_id, v_actor, p_field_kind,
    nullif(trim(coalesce(p_label,'')),''), trim(p_value_text)
  )
  on conflict do nothing;

  select id into v_id from public.household_transition_private_fields
  where workflow_id = p_workflow_id and owner_membership_id = v_actor and field_kind = p_field_kind
  order by created_at desc limit 1;

  if v_id is null then
    -- update latest of same kind
    update public.household_transition_private_fields set
      value_text = trim(p_value_text),
      label = coalesce(nullif(trim(coalesce(p_label,'')),''), label)
    where id = (
      select f.id from public.household_transition_private_fields f
      where f.workflow_id = p_workflow_id and f.owner_membership_id = v_actor
        and f.field_kind = p_field_kind
      order by f.created_at desc limit 1
    )
    returning id into v_id;
  end if;

  if v_id is null then
    insert into public.household_transition_private_fields(
      workflow_id, household_id, owner_membership_id, field_kind, label, value_text
    ) values (
      p_workflow_id, v_wf.household_id, v_actor, p_field_kind,
      nullif(trim(coalesce(p_label,'')),''), trim(p_value_text)
    ) returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function public.grant_transition_private_field(
  p_field_id uuid,
  p_grantee_membership_id uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_field public.household_transition_private_fields%rowtype;
  v_actor uuid; v_id uuid;
begin
  perform set_config('householdos.governance_mutation', 'rpc', true);
  select * into v_field from public.household_transition_private_fields where id = p_field_id;
  if not found then raise exception 'Private field not found'; end if;
  v_actor := public._governance_active_membership(v_field.household_id);
  if v_field.owner_membership_id <> v_actor then
    raise exception 'Only the field owner may grant access';
  end if;

  insert into public.household_transition_private_grants(
    private_field_id, household_id, grantee_membership_id, granted_by_membership_id
  ) values (
    p_field_id, v_field.household_id, p_grantee_membership_id, v_actor
  )
  on conflict (private_field_id, grantee_membership_id) do nothing
  returning id into v_id;
  return coalesce(v_id, (
    select g.id from public.household_transition_private_grants g
    where g.private_field_id = p_field_id and g.grantee_membership_id = p_grantee_membership_id
  ));
end $$;

create or replace function public.add_governance_attachment(
  p_household_id uuid,
  p_storage_path text,
  p_mime_type text,
  p_file_name text,
  p_size_bytes integer,
  p_document_id uuid default null,
  p_version_id uuid default null,
  p_comment_id uuid default null,
  p_transition_task_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid; v_id uuid;
begin
  perform set_config('householdos.governance_mutation', 'rpc', true);
  v_actor := public._governance_active_membership(p_household_id);
  if p_size_bytes is null or p_size_bytes <= 0 or p_size_bytes > 8388608 then
    raise exception 'Attachment exceeds size limit';
  end if;
  if p_mime_type not in ('image/jpeg','image/png','image/webp','application/pdf','text/plain') then
    raise exception 'Unsupported attachment type';
  end if;
  if p_storage_path is null or split_part(p_storage_path, '/', 1) is distinct from p_household_id::text then
    raise exception 'Storage path must be scoped to the household';
  end if;
  if p_document_id is not null and not public.can_view_governance_document(p_document_id) then
    raise exception 'Not allowed to attach to this document';
  end if;

  insert into public.governance_attachments(
    household_id, document_id, version_id, comment_id, transition_task_id,
    storage_path, mime_type, file_name, size_bytes, uploaded_by_membership_id
  ) values (
    p_household_id, p_document_id, p_version_id, p_comment_id, p_transition_task_id,
    p_storage_path, p_mime_type, trim(p_file_name), p_size_bytes, v_actor
  ) returning id into v_id;

  if p_document_id is not null then
    perform public._governance_append_event(
      p_document_id, p_household_id, v_actor, 'attachment_added', p_version_id, null,
      jsonb_build_object('attachment_id', v_id)
    );
  end if;
  return v_id;
end $$;

create or replace function public.remove_governance_attachment(
  p_attachment_id uuid,
  p_reason text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_att public.governance_attachments%rowtype;
  v_actor uuid;
begin
  perform set_config('householdos.governance_mutation', 'rpc', true);
  select * into v_att from public.governance_attachments where id = p_attachment_id for update;
  if not found then raise exception 'Attachment not found'; end if;
  v_actor := public._governance_active_membership(v_att.household_id);

  -- Soft delete / tombstone; approved content retention prefers archival
  update public.governance_attachments set
    deleted_at = now(),
    deletion_reason = nullif(trim(coalesce(p_reason,'')),'')
  where id = p_attachment_id;

  if v_att.document_id is not null then
    perform public._governance_append_event(
      v_att.document_id, v_att.household_id, v_actor, 'attachment_removed', v_att.version_id,
      p_reason, jsonb_build_object('attachment_id', p_attachment_id)
    );
  end if;
  return p_attachment_id;
end $$;

grant execute on function public.create_household_transition(uuid,text,uuid,date,date,text,uuid,text,uuid) to authenticated;
grant execute on function public.advance_household_transition(uuid,text,text) to authenticated;
grant execute on function public.complete_household_transition_task(uuid,text) to authenticated;
grant execute on function public.complete_household_transition(uuid,text,boolean,timestamptz) to authenticated;
grant execute on function public.cancel_household_transition(uuid,text) to authenticated;
grant execute on function public.upsert_transition_private_field(uuid,text,text,text) to authenticated;
grant execute on function public.grant_transition_private_field(uuid,uuid) to authenticated;
grant execute on function public.add_governance_attachment(uuid,text,text,text,integer,uuid,uuid,uuid,uuid) to authenticated;
grant execute on function public.remove_governance_attachment(uuid,text) to authenticated;
