-- Phase 7A: wire create_meal_request, mark_meal_prepared, grants, notifications

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

-- Update mark_meal_prepared to record prep history + request feedback
create or replace function public.mark_meal_prepared(
  p_meal_plan_id uuid,
  p_create_batch boolean default true,
  p_batch_quantity numeric default null,
  p_remaining_state text default 'plenty',
  p_location_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_plan public.meal_plans%rowtype;
  v_actor uuid;
  v_batch_id uuid;
  v_use_soon boolean := false;
  v_shop_high boolean := false;
  v_cat_count int := 0;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  select * into v_plan from public.meal_plans where id = p_meal_plan_id for update;
  if not found then raise exception 'Meal plan not found'; end if;
  v_actor := public._meal_active_membership(v_plan.household_id);
  if v_plan.organizer_membership_id <> v_actor and v_plan.cooking_membership_id is distinct from v_actor then
    raise exception 'Not allowed to mark prepared';
  end if;
  if v_plan.status = 'prepared' then
    select id into v_batch_id from public.meal_prep_batches where meal_plan_id = p_meal_plan_id limit 1;
    return coalesce(v_batch_id, p_meal_plan_id);
  end if;
  update public.meal_plans set status = 'prepared', prepared_at = now() where id = p_meal_plan_id;
  update public.scheduled_notification_requests set cancelled_at = now()
  where source_type = 'meal_plan' and source_id = p_meal_plan_id
    and event_type like 'meal.%'
    and processed_at is null and cancelled_at is null;

  if p_create_batch then
    insert into public.meal_prep_batches(
      household_id, meal_plan_id, recipe_id, name, prepared_by_membership_id,
      availability, approximate_starting_quantity, quantity_unit, remaining_state, location_id,
      owner_membership_id
    ) values (
      v_plan.household_id, p_meal_plan_id, v_plan.recipe_id, v_plan.title, v_actor,
      case when v_plan.meal_type = 'personal' then 'personal' else 'household' end,
      coalesce(p_batch_quantity, v_plan.target_servings), 'serving',
      coalesce(p_remaining_state,'plenty'), p_location_id,
      case when v_plan.meal_type = 'personal' then v_actor else null end
    ) returning id into v_batch_id;
    insert into public.meal_batch_stock_events(batch_id, household_id, event_type, new_remaining_state, recorded_by_membership_id)
    values (v_batch_id, v_plan.household_id, 'created', coalesce(p_remaining_state,'plenty'), v_actor);
  end if;

  -- Prep history (never infer like/dislike)
  if v_plan.recipe_id is not null then
    select exists (
      select 1 from public.meal_plan_ingredients mpi
      where mpi.meal_plan_id = p_meal_plan_id and mpi.pantry_match_status = 'use_soon'
    ) into v_use_soon;
    select exists (
      select 1 from public.meal_shopping_proposals sp
      join public.meal_shopping_proposal_lines spl on spl.proposal_id = sp.id
      where sp.meal_plan_id = p_meal_plan_id
    ) into v_shop_high;
    select count(*)::int into v_cat_count
    from public.meal_plans mp
    join public.recipes r on r.id = mp.recipe_id
    where mp.household_id = v_plan.household_id
      and mp.status = 'prepared'
      and mp.prepared_at > now() - interval '14 days'
      and r.category = (select category from public.recipes where id = v_plan.recipe_id);

    insert into public.recipe_prep_history(
      household_id, recipe_id, times_prepared, last_prepared_at, last_meal_type,
      last_used_for_meal_prep, last_shopping_requirement_high, last_consumed_use_soon,
      recent_category_count
    ) values (
      v_plan.household_id, v_plan.recipe_id, 1, now(), v_plan.meal_type,
      v_plan.meal_type = 'meal_prep', v_shop_high, v_use_soon, v_cat_count
    )
    on conflict (recipe_id, household_id) do update set
      times_prepared = recipe_prep_history.times_prepared + 1,
      last_prepared_at = now(),
      last_meal_type = excluded.last_meal_type,
      last_used_for_meal_prep = excluded.last_used_for_meal_prep,
      last_shopping_requirement_high = excluded.last_shopping_requirement_high,
      last_consumed_use_soon = excluded.last_consumed_use_soon,
      recent_category_count = excluded.recent_category_count;

    update public.recipe_user_preferences
    set times_prepared = times_prepared + 1, last_prepared_at = now()
    where recipe_id = v_plan.recipe_id
      and membership_id in (
        select membership_id from public.meal_attendees
        where meal_plan_id = p_meal_plan_id and attendance_status = 'going'
      );
  end if;

  perform public._meal_audit(v_plan.household_id, 'meal_plan', p_meal_plan_id, 'meal.prepared');
  perform public._meal_notify(
    v_plan.household_id, 'meal.prepared', 'meal_plan', p_meal_plan_id, v_actor,
    array(
      select a.membership_id from public.meal_attendees a
      where a.meal_plan_id = p_meal_plan_id and a.attendance_status in ('going','maybe')
    ),
    'Meal prepared',
    'A household meal was marked prepared.',
    '/app/' || v_plan.household_id::text || '/meals/' || p_meal_plan_id::text
  );

  -- Optional one-shot feedback (idempotent; not required)
  perform public.request_recipe_feedback(p_meal_plan_id);

  return coalesce(v_batch_id, p_meal_plan_id);
end $$;

-- Grants (drop old create_meal_request signature grant if needed)
grant execute on function public.set_recipe_preference(uuid,text,boolean,int,int,int,int,int,text,boolean) to authenticated;
grant execute on function public.clear_recipe_preference(uuid) to authenticated;
grant execute on function public.request_recipe_feedback(uuid) to authenticated;
grant execute on function public.submit_recipe_feedback(uuid,text,boolean,int,int,int,int,int,text,boolean) to authenticated;
grant execute on function public.dismiss_recipe_feedback(uuid) to authenticated;
grant execute on function public.run_recipe_recommendation(uuid) to authenticated;
grant execute on function public.rank_recipe_candidates(uuid) to authenticated;
grant execute on function public.get_recipe_recommendation_results(uuid) to authenticated;
grant execute on function public.accept_recipe_recommendation(uuid,uuid,date,numeric,boolean,uuid[]) to authenticated;
grant execute on function public.recalculate_meal_recommendation_context(uuid) to authenticated;
grant execute on function public.create_meal_request(uuid,text,date,int,numeric,int,int,boolean,text,jsonb,text,text,uuid[],jsonb,boolean) to authenticated;
grant execute on function public.mark_meal_prepared(uuid,boolean,numeric,text,uuid) to authenticated;

-- Keep legacy create_meal_request overload working via defaulted new params:
-- PostgreSQL may retain both signatures; grant the old one too if it still exists.
do $$
begin
  begin
    grant execute on function public.create_meal_request(uuid,text,date,int,numeric,int,int,boolean,text,jsonb) to authenticated;
  exception when undefined_function then
    null;
  end;
end $$;
