-- Phase 8: governance notifications mapping + storage bucket + cleanup

create or replace function public._notification_meta_for_event_type(p_event_type text)
returns table (
  category text,
  urgency text,
  action_oriented boolean
)
language sql
immutable
as $$
  select
    case
      when p_event_type like 'dispute.%' then 'disputes'
      when p_event_type like 'payment.%'
        or p_event_type like 'waiver.%'
        or p_event_type like 'refund_obligation.%'
        or p_event_type like 'expense.%' then 'payments'
      when p_event_type like 'membership.%' then 'membership'
      when p_event_type like 'chore.%' then 'chores'
      when p_event_type like 'calendar.%' then 'calendar'
      when p_event_type like 'inventory.%'
        or p_event_type like 'pantry.%'
        or p_event_type like 'shopping.%'
        or p_event_type like 'house.%' then 'house'
      when p_event_type like 'recipe.%'
        or p_event_type like 'meal.%'
        or p_event_type like 'meal_prep.%'
        or p_event_type like 'meal_batch.%' then 'meals'
      when p_event_type like 'maintenance.%' then 'maintenance'
      when p_event_type like 'governance.%'
        or p_event_type like 'approval.%'
        or p_event_type like 'agreement.%' then
        case
          when p_event_type like '%acknowled%' then 'agreements'
          when p_event_type like '%approval%'
            or p_event_type like '%proposed%'
            or p_event_type like '%reject%'
            or p_event_type like '%changes%' then 'approvals'
          else 'agreements'
        end
      when p_event_type like 'system.%' then 'system'
      else 'system'
    end,
    case
      when p_event_type in (
        'payment.awaiting_confirmation',
        'payment.rejected',
        'payment.reversed',
        'waiver.reversed',
        'dispute.opened',
        'refund_obligation.created',
        'expense.voided',
        'meal.cancelled',
        'meal.shopping_needed',
        'maintenance.reported',
        'maintenance.severity_changed',
        'maintenance.appointment_scheduled',
        'governance.acknowledgment_overdue',
        'governance.proposal_rejected',
        'governance.transition_deadline_approaching'
      ) then 'high'
      when p_event_type like 'system.%urgent%'
        or p_event_type = 'maintenance.reopened' then 'urgent'
      else 'normal'
    end,
    case
      when p_event_type in (
        'payment.awaiting_confirmation',
        'payment.rejected',
        'waiver.created',
        'waiver.reversed',
        'dispute.opened',
        'refund_obligation.created',
        'expense.voided',
        'expense.amended',
        'meal.rsvp_requested',
        'meal.shopping_needed',
        'meal.cleanup_assigned',
        'maintenance.assigned',
        'maintenance.waiting_on_household',
        'maintenance.appointment_scheduled',
        'maintenance.vendor_response_needed',
        'governance.approval_requested',
        'governance.acknowledgment_requested',
        'governance.acknowledgment_overdue',
        'governance.changes_requested',
        'governance.transition_task_assigned',
        'governance.transition_deadline_approaching'
      ) then true
      else false
    end;
$$;

revoke all on function public._notification_meta_for_event_type(text) from public;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'governance-attachments',
  'governance-attachments',
  false,
  8388608,
  array['image/jpeg','image/png','image/webp','application/pdf','text/plain']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists governance_attachments_storage_select on storage.objects;
drop policy if exists governance_attachments_storage_insert on storage.objects;
drop policy if exists governance_attachments_storage_update on storage.objects;
drop policy if exists governance_attachments_storage_delete on storage.objects;

create policy governance_attachments_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'governance-attachments'
    and public.is_active_member((storage.foldername(name))[1]::uuid)
  );

create policy governance_attachments_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'governance-attachments'
    and public.is_active_member((storage.foldername(name))[1]::uuid)
  );

create policy governance_attachments_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'governance-attachments'
    and public.is_active_member((storage.foldername(name))[1]::uuid)
  );

create policy governance_attachments_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'governance-attachments'
    and public.is_active_member((storage.foldername(name))[1]::uuid)
  );

create or replace function public._test_cleanup_governance_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('householdos.privileged_mutation', true) is distinct from 'on' then
    raise exception 'privileged_mutation required';
  end if;
  perform set_config('householdos.governance_mutation', 'rpc', true);
  delete from public.governance_calendar_links where household_id = p_household_id;
  delete from public.household_transition_maintenance_links where household_id = p_household_id;
  delete from public.household_transition_inventory_links where household_id = p_household_id;
  delete from public.household_transition_private_grants where household_id = p_household_id;
  delete from public.household_transition_private_fields where household_id = p_household_id;
  delete from public.household_transition_events where household_id = p_household_id;
  delete from public.household_transition_tasks where household_id = p_household_id;
  delete from public.household_transition_workflows where household_id = p_household_id;
  delete from public.governance_attachments where household_id = p_household_id;
  delete from public.governance_expense_refs where household_id = p_household_id;
  delete from public.governance_events where household_id = p_household_id;
  delete from public.governance_comments where household_id = p_household_id;
  delete from public.governance_acknowledgments where household_id = p_household_id;
  delete from public.governance_approval_responses where household_id = p_household_id;
  delete from public.governance_approval_requests where household_id = p_household_id;
  delete from public.governance_participants where household_id = p_household_id;
  delete from public.governance_sections where household_id = p_household_id;
  update public.governance_documents set current_version_id = null, active_version_id = null
    where household_id = p_household_id;
  delete from public.governance_document_versions where household_id = p_household_id;
  delete from public.governance_documents where household_id = p_household_id;
  delete from public.governance_templates where household_id = p_household_id;
end $$;

revoke all on function public._test_cleanup_governance_household(uuid) from public, anon, authenticated;
grant execute on function public._test_cleanup_governance_household(uuid) to service_role;
