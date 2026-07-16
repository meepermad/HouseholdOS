-- Extend test cleanup for Phase 6 house resource tables (locations, inventory,
-- supply, pantry, shopping, expense links). These are deleted before chores
-- because inventory/supply reference responsibility_areas and chore
-- definitions, and shopping items reference chore occurrences.

create or replace function public.cleanup_test_household_data(p_test_run_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
  v_count integer := 0;
  v_id uuid;
  v_member_ids uuid[];
begin
  if coalesce(auth.jwt() ->> 'role', '') is distinct from 'service_role' then
    raise exception 'cleanup_test_household_data requires service_role';
  end if;
  if p_test_run_id is null
     or char_length(trim(p_test_run_id)) < 8
     or trim(p_test_run_id) !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'cleanup_test_household_data requires a safe test-run identifier';
  end if;

  perform set_config('householdos.privileged_mutation', 'on', true);
  perform set_config('householdos.calendar_mutation', 'rpc', true);
  perform set_config('householdos.chore_mutation', 'rpc', true);
  perform set_config('householdos.resource_mutation', 'rpc', true);

  select array_agg(h.id) into v_ids
  from public.households h
  where h.name like '%' || trim(p_test_run_id) || '%';

  if v_ids is null then
    return 0;
  end if;

  foreach v_id in array v_ids loop
    select array_agg(m.user_id) into v_member_ids
    from public.household_memberships m
    where m.household_id = v_id;

    delete from public.notification_digest_items di
      using public.user_notifications un
      where un.id = di.user_notification_id
        and un.household_id = v_id;

    if v_member_ids is not null then
      delete from public.notification_digest_batches b
        where b.user_id = any (v_member_ids)
          and not exists (
            select 1
            from public.notification_digest_items di
            where di.batch_id = b.id
          );

      delete from public.scheduled_notification_requests r
        where r.recipient_user_id = any (v_member_ids);
    end if;

    delete from public.notification_deliveries d
      using public.notification_events e
      where e.id = d.event_id and e.household_id = v_id;
    delete from public.user_notifications where household_id = v_id;
    delete from public.notification_events where household_id = v_id;

    -- House resources (before chores/responsibility areas/calendar they may reference)
    delete from public.resource_expense_links where household_id = v_id;
    delete from public.shopping_list_items where household_id = v_id;
    delete from public.shopping_lists where household_id = v_id;
    delete from public.pantry_stock_events where household_id = v_id;
    delete from public.pantry_visibility_members where household_id = v_id;
    delete from public.pantry_items where household_id = v_id;
    delete from public.supply_stock_events where household_id = v_id;
    delete from public.supply_items where household_id = v_id;
    delete from public.inventory_condition_events where household_id = v_id;
    delete from public.inventory_ownership_members where household_id = v_id;
    delete from public.inventory_items where household_id = v_id;
    delete from public.household_locations where household_id = v_id;

    -- Chores / responsibilities (before calendar events they may link to)
    delete from public.chore_reassignment_requests where household_id = v_id;
    delete from public.chore_completion_records where household_id = v_id;
    delete from public.chore_assignments where household_id = v_id;
    update public.chore_occurrences set calendar_event_id = null where household_id = v_id;
    delete from public.chore_occurrences where household_id = v_id;
    delete from public.chore_definitions where household_id = v_id;
    delete from public.chore_rotation_members where household_id = v_id;
    delete from public.chore_rotations where household_id = v_id;
    delete from public.responsibility_transfers where household_id = v_id;
    delete from public.responsibility_assignments where household_id = v_id;
    delete from public.responsibility_areas where household_id = v_id;

    -- Calendar data
    delete from public.calendar_feed_tokens where household_id = v_id;
    delete from public.calendar_event_exception_reminders where household_id = v_id;
    delete from public.calendar_event_exception_attendees where household_id = v_id;
    delete from public.calendar_event_reminders where household_id = v_id;
    delete from public.calendar_event_exceptions where household_id = v_id;
    delete from public.calendar_event_occurrences where household_id = v_id;
    delete from public.calendar_event_attendees where household_id = v_id;
    delete from public.calendar_events where household_id = v_id;

    delete from public.dispute_events where household_id = v_id;
    delete from public.reimbursement_disputes where household_id = v_id;
    delete from public.reimbursement_waiver_reversals where household_id = v_id;
    delete from public.reimbursement_waivers where household_id = v_id;
    delete from public.payment_reversals where household_id = v_id;
    delete from public.payment_allocations where household_id = v_id;
    delete from public.payment_private_details where household_id = v_id;
    delete from public.payments where household_id = v_id;
    delete from public.reimbursement_obligations where household_id = v_id;
    delete from public.expense_amendments where household_id = v_id;
    delete from public.expense_adjustment_allocations where household_id = v_id;
    delete from public.expense_item_allocations where household_id = v_id;
    delete from public.expense_adjustments where household_id = v_id;
    delete from public.expense_items where household_id = v_id;
    update public.expenses
      set superseded_by_expense_id = null, supersedes_expense_id = null
      where household_id = v_id;
    delete from public.expenses where household_id = v_id;
    delete from public.audit_events where household_id = v_id;
    delete from public.household_invitations where household_id = v_id;
    delete from public.household_settings where household_id = v_id;
    update public.user_preferences
      set current_household_id = null
      where current_household_id = v_id;
    delete from public.household_membership_roles r
      using public.household_memberships m
      where m.id = r.membership_id and m.household_id = v_id;
    delete from public.household_memberships where household_id = v_id;
    delete from public.households where id = v_id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.cleanup_test_household_data(text) from public;
grant execute on function public.cleanup_test_household_data(text) to service_role;
