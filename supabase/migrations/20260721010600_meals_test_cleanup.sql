-- Phase 6.5: narrow test cleanup helpers for meal domain

create or replace function public._test_cleanup_meal_household(p_household_id uuid)
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
  perform set_config('householdos.meal_mutation', 'rpc', true);
  perform set_config('householdos.resource_mutation', 'rpc', true);

  delete from public.meal_batch_stock_events where household_id = p_household_id;
  delete from public.meal_prep_batches where household_id = p_household_id;
  delete from public.meal_shopping_proposal_lines where household_id = p_household_id;
  delete from public.meal_shopping_proposals where household_id = p_household_id;
  delete from public.meal_plan_expense_links where household_id = p_household_id;
  delete from public.meal_plan_chore_links where household_id = p_household_id;
  delete from public.meal_plan_assignments where household_id = p_household_id;
  delete from public.meal_plan_ingredients where household_id = p_household_id;
  delete from public.meal_attendees where household_id = p_household_id;
  update public.meal_requests set accepted_meal_plan_id = null where household_id = p_household_id;
  delete from public.meal_plans where household_id = p_household_id;
  delete from public.meal_request_results where household_id = p_household_id;
  delete from public.meal_request_constraints where household_id = p_household_id;
  delete from public.meal_requests where household_id = p_household_id;
  delete from public.recipe_user_preferences where household_id = p_household_id;
  delete from public.recipe_equipment where household_id = p_household_id;
  delete from public.recipe_steps where household_id = p_household_id;
  delete from public.recipe_ingredients where household_id = p_household_id;
  delete from public.recipe_visibility_members where household_id = p_household_id;
  delete from public.recipes where household_id = p_household_id;
  delete from public.member_dietary_preferences where household_id = p_household_id;
  delete from public.household_meal_settings where household_id = p_household_id;
end $$;

revoke all on function public._test_cleanup_meal_household(uuid) from public, anon, authenticated;
grant execute on function public._test_cleanup_meal_household(uuid) to service_role;
