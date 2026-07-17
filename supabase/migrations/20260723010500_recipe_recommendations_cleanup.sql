-- Phase 7A: notifications catalog hooks + test cleanup + drop legacy overload

drop function if exists public.create_meal_request(uuid,text,date,int,numeric,int,int,boolean,text,jsonb);

-- Re-create after drop (same body as wireup) — ensure single signature
create or replace function public.create_meal_request(
  p_household_id uuid,
  p_meal_type text default 'shared_household',
  p_target_date date default null,
  p_guest_count int default 0,
  p_desired_servings numeric default null,
  p_max_total_minutes int default null,
  p_max_missing_ingredients int default null,
  p_pantry_only boolean default false,
  p_note text default null,
  p_constraints jsonb default '[]'::jsonb,
  p_ranking_mode text default 'best_overall',
  p_preference_scope text default null,
  p_attendee_membership_ids uuid[] default '{}',
  p_guest_constraints jsonb default '[]'::jsonb,
  p_strict_time_limit boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid; v_id uuid; v_c jsonb; v_mid uuid; v_scope text; v_mode text; v_g jsonb;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  v_actor := public._meal_active_membership(p_household_id);

  v_mode := coalesce(nullif(trim(p_ranking_mode),''), 'best_overall');
  if v_mode not in (
    'best_overall','use_what_we_have','use_food_soon','household_favorite',
    'fastest','fewest_missing_items','meal_prep_friendly','guest_friendly',
    'something_different'
  ) then
    raise exception 'Invalid ranking mode';
  end if;

  v_scope := coalesce(
    nullif(trim(p_preference_scope),''),
    case when p_meal_type = 'open_household' then 'household' else 'attendees' end
  );
  if v_scope not in ('attendees','household') then
    raise exception 'Invalid preference scope';
  end if;

  insert into public.meal_requests(
    household_id, created_by_membership_id, meal_type, target_date, guest_count,
    desired_servings, max_total_minutes, max_missing_ingredients, pantry_only, note, status,
    ranking_mode, preference_scope, strict_time_limit
  ) values (
    p_household_id, v_actor, p_meal_type, p_target_date, coalesce(p_guest_count,0),
    p_desired_servings, p_max_total_minutes, p_max_missing_ingredients,
    coalesce(p_pantry_only,false), nullif(trim(coalesce(p_note,'')),''), 'open',
    v_mode, v_scope, coalesce(p_strict_time_limit, false)
  ) returning id into v_id;

  for v_c in select * from jsonb_array_elements(coalesce(p_constraints,'[]'::jsonb))
  loop
    insert into public.meal_request_constraints(meal_request_id, household_id, constraint_type, value)
    values (v_id, p_household_id, v_c->>'constraint_type', trim(v_c->>'value'));
  end loop;

  foreach v_mid in array coalesce(p_attendee_membership_ids, '{}'::uuid[])
  loop
    if not exists (
      select 1 from public.household_memberships m
      where m.id = v_mid and m.household_id = p_household_id and m.status = 'active'
    ) then
      raise exception 'Attendee must be an active household member';
    end if;
    insert into public.meal_request_attendees(meal_request_id, household_id, membership_id)
    values (v_id, p_household_id, v_mid)
    on conflict do nothing;
  end loop;

  for v_g in select * from jsonb_array_elements(coalesce(p_guest_constraints,'[]'::jsonb))
  loop
    insert into public.meal_request_guest_constraints(meal_request_id, household_id, label)
    values (v_id, p_household_id, trim(v_g->>'label'));
  end loop;

  perform public._meal_audit(p_household_id, 'meal_request', v_id, 'meal.request_created');
  perform public.run_recipe_recommendation(v_id);
  return v_id;
end $$;

grant execute on function public.create_meal_request(uuid,text,date,int,numeric,int,int,boolean,text,jsonb,text,text,uuid[],jsonb,boolean) to authenticated;

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

  delete from public.recipe_import_drafts where household_id = p_household_id;
  delete from public.recipe_recommendation_score_components where household_id = p_household_id;
  delete from public.recipe_recommendation_results where household_id = p_household_id;
  update public.meal_requests set last_recommendation_run_id = null where household_id = p_household_id;
  delete from public.recipe_recommendation_runs where household_id = p_household_id;
  delete from public.recipe_feedback_responses where household_id = p_household_id;
  delete from public.recipe_feedback_requests where household_id = p_household_id;
  delete from public.recipe_prep_history where household_id = p_household_id;
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
  delete from public.meal_request_guest_constraints where household_id = p_household_id;
  delete from public.meal_request_attendees where household_id = p_household_id;
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
