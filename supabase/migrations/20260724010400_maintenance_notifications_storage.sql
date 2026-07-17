-- Phase 7B: maintenance notifications mapping + storage bucket + cleanup

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
        'maintenance.appointment_scheduled'
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
        'maintenance.vendor_response_needed'
      ) then true
      else false
    end;
$$;

revoke all on function public._notification_meta_for_event_type(text) from public;

-- Private evidence bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'maintenance-evidence',
  'maintenance-evidence',
  false,
  8388608,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists maintenance_evidence_select on storage.objects;
drop policy if exists maintenance_evidence_insert on storage.objects;
drop policy if exists maintenance_evidence_update on storage.objects;
drop policy if exists maintenance_evidence_delete on storage.objects;

create policy maintenance_evidence_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'maintenance-evidence'
    and public.is_active_member((storage.foldername(name))[1]::uuid)
  );

create policy maintenance_evidence_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'maintenance-evidence'
    and public.is_active_member((storage.foldername(name))[1]::uuid)
  );

create policy maintenance_evidence_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'maintenance-evidence'
    and public.is_active_member((storage.foldername(name))[1]::uuid)
  );

create policy maintenance_evidence_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'maintenance-evidence'
    and public.is_active_member((storage.foldername(name))[1]::uuid)
  );

create or replace function public._test_cleanup_maintenance_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('householdos.privileged_mutation', true) is distinct from 'on'
     and current_setting('role', true) is distinct from 'service_role' then
    raise exception 'Test cleanup requires privileged context';
  end if;
  perform set_config('householdos.maintenance_mutation', 'rpc', true);
  perform set_config('householdos.calendar_mutation', 'rpc', true);

  delete from public.maintenance_attachments where household_id = p_household_id;
  delete from public.maintenance_warranty_claims where household_id = p_household_id;
  delete from public.maintenance_quotes where household_id = p_household_id;
  delete from public.maintenance_contact_events where household_id = p_household_id;
  delete from public.maintenance_expense_links where household_id = p_household_id;
  delete from public.maintenance_inventory_links where household_id = p_household_id;
  delete from public.maintenance_chore_links where household_id = p_household_id;
  delete from public.maintenance_calendar_links where household_id = p_household_id;
  delete from public.maintenance_actions where household_id = p_household_id;
  delete from public.maintenance_events where household_id = p_household_id;
  delete from public.maintenance_assignments where household_id = p_household_id;
  delete from public.maintenance_request_participants where household_id = p_household_id;
  update public.maintenance_requests set linked_as_recurrence_of = null where household_id = p_household_id;
  delete from public.maintenance_requests where household_id = p_household_id;
  delete from public.maintenance_external_contacts where household_id = p_household_id;
  delete from public.calendar_events
  where household_id = p_household_id and source_type = 'maintenance_request';
end $$;

grant execute on function public._test_cleanup_maintenance_household(uuid) to service_role;
