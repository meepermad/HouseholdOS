-- Phase 7A: preference / feedback / recommendation RPCs
-- Scoring version "1" — keep aligned with src/lib/meals/scoring/weights.ts

create or replace function public._recommendation_mode_mult(
  p_mode text,
  p_key text
) returns numeric language sql immutable as $$
  select case
    when p_mode = 'use_what_we_have' and p_key = 'pantry_coverage' then 1.6
    when p_mode = 'use_what_we_have' and p_key = 'missing_required_count' then 1.8
    when p_mode = 'use_what_we_have' and p_key = 'use_soon_utilization' then 0.7
    when p_mode = 'use_what_we_have' and p_key = 'shopping_cost_estimate' then 1.4
    when p_mode = 'use_food_soon' and p_key = 'use_soon_utilization' then 2.5
    when p_mode = 'use_food_soon' and p_key = 'pantry_coverage' then 1.1
    when p_mode = 'use_food_soon' and p_key = 'recently_prepared_penalty' then 0.5
    when p_mode = 'household_favorite' and p_key = 'attendee_preference' then 2.2
    when p_mode = 'household_favorite' and p_key = 'favorite_bonus' then 2.0
    when p_mode = 'household_favorite' and p_key = 'strong_dislike_penalty' then 1.5
    when p_mode = 'household_favorite' and p_key = 'pantry_coverage' then 0.7
    when p_mode = 'fastest' and p_key = 'time_fit' then 3.0
    when p_mode = 'fastest' and p_key = 'pantry_coverage' then 0.6
    when p_mode = 'fastest' and p_key = 'meal_prep_fit' then 0.4
    when p_mode = 'fewest_missing_items' and p_key = 'missing_required_count' then 2.5
    when p_mode = 'fewest_missing_items' and p_key = 'missing_optional_count' then 1.5
    when p_mode = 'fewest_missing_items' and p_key = 'pantry_coverage' then 1.3
    when p_mode = 'fewest_missing_items' and p_key = 'shopping_cost_estimate' then 1.5
    when p_mode = 'meal_prep_friendly' and p_key = 'meal_prep_fit' then 2.5
    when p_mode = 'meal_prep_friendly' and p_key = 'serving_scalability' then 1.4
    when p_mode = 'guest_friendly' and p_key = 'guest_fit' then 2.5
    when p_mode = 'guest_friendly' and p_key = 'serving_scalability' then 1.6
    when p_mode = 'something_different' and p_key = 'recently_prepared_penalty' then 2.2
    when p_mode = 'something_different' and p_key = 'category_repetition_penalty' then 2.0
    when p_mode = 'something_different' and p_key = 'novelty_bonus' then 2.5
    when p_mode = 'something_different' and p_key = 'favorite_bonus' then 0.5
    else 1.0
  end;
$$;

create or replace function public._recommendation_base_weight(p_key text)
returns numeric language sql immutable as $$
  select case p_key
    when 'pantry_coverage' then 40
    when 'use_soon_utilization' then 8
    when 'missing_required_count' then -5
    when 'missing_optional_count' then -1
    when 'unit_uncertainty' then -2
    when 'attendee_preference' then 1
    when 'strong_dislike_penalty' then -25
    when 'favorite_bonus' then 12
    when 'time_fit' then 1
    when 'meal_type_fit' then 8
    when 'equipment_fit' then 5
    when 'serving_scalability' then 6
    when 'meal_prep_fit' then 10
    when 'guest_fit' then 10
    when 'recently_prepared_penalty' then -15
    when 'category_repetition_penalty' then -6
    when 'shopping_cost_estimate' then -3
    when 'novelty_bonus' then 4
    else 0
  end;
$$;

revoke all on function public._recommendation_mode_mult(text, text) from public, anon;
revoke all on function public._recommendation_base_weight(text) from public, anon;

create or replace function public._recommendation_weight(p_mode text, p_key text)
returns numeric language sql immutable as $$
  select public._recommendation_base_weight(p_key)
       * public._recommendation_mode_mult(p_mode, p_key);
$$;
revoke all on function public._recommendation_weight(text, text) from public, anon;

-- ---------------------------------------------------------------------------
-- Preferences
-- ---------------------------------------------------------------------------
create or replace function public.set_recipe_preference(
  p_recipe_id uuid,
  p_preference_signal text,
  p_is_favorite boolean default null,
  p_taste int default null,
  p_ease int default null,
  p_cost int default null,
  p_meal_prep_usefulness int default null,
  p_guest_friendliness int default null,
  p_private_note text default null,
  p_share_identity_with_organizer boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_recipe public.recipes%rowtype;
  v_actor uuid;
  v_fav boolean;
  v_signal text;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  select * into v_recipe from public.recipes where id = p_recipe_id;
  if not found then raise exception 'Recipe not found'; end if;
  if not public.can_view_recipe(p_recipe_id) then raise exception 'Recipe not visible'; end if;
  v_actor := public._meal_active_membership(v_recipe.household_id);

  if p_preference_signal not in (
    'favorite','would_make_again','okay','would_not_choose_again','have_not_tried'
  ) then
    raise exception 'Invalid preference signal';
  end if;

  v_signal := p_preference_signal;
  v_fav := coalesce(p_is_favorite, p_preference_signal = 'favorite');
  if v_fav then v_signal := 'favorite'; end if;

  insert into public.recipe_user_preferences(
    household_id, recipe_id, membership_id, preference_signal, is_favorite,
    would_make_again, taste, ease, cost, meal_prep_usefulness, guest_friendliness,
    private_note, share_identity_with_organizer
  ) values (
    v_recipe.household_id, p_recipe_id, v_actor, v_signal, v_fav,
    case
      when v_signal in ('favorite','would_make_again') then true
      when v_signal = 'would_not_choose_again' then false
      else null
    end,
    p_taste, p_ease, p_cost, p_meal_prep_usefulness, p_guest_friendliness,
    nullif(trim(coalesce(p_private_note,'')),''),
    coalesce(p_share_identity_with_organizer, false)
  )
  on conflict (recipe_id, membership_id) do update set
    preference_signal = excluded.preference_signal,
    is_favorite = excluded.is_favorite,
    would_make_again = excluded.would_make_again,
    taste = coalesce(excluded.taste, recipe_user_preferences.taste),
    ease = coalesce(excluded.ease, recipe_user_preferences.ease),
    cost = coalesce(excluded.cost, recipe_user_preferences.cost),
    meal_prep_usefulness = coalesce(excluded.meal_prep_usefulness, recipe_user_preferences.meal_prep_usefulness),
    guest_friendliness = coalesce(excluded.guest_friendliness, recipe_user_preferences.guest_friendliness),
    private_note = coalesce(excluded.private_note, recipe_user_preferences.private_note),
    share_identity_with_organizer = excluded.share_identity_with_organizer;

  perform public._meal_audit(
    v_recipe.household_id, 'recipe', p_recipe_id, 'recipe.preference_set',
    null, jsonb_build_object('has_preference', true), null
  );
  return p_recipe_id;
end $$;

create or replace function public.clear_recipe_preference(p_recipe_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_recipe public.recipes%rowtype; v_actor uuid;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  select * into v_recipe from public.recipes where id = p_recipe_id;
  if not found then raise exception 'Recipe not found'; end if;
  v_actor := public._meal_active_membership(v_recipe.household_id);
  delete from public.recipe_user_preferences
  where recipe_id = p_recipe_id and membership_id = v_actor;
  perform public._meal_audit(
    v_recipe.household_id, 'recipe', p_recipe_id, 'recipe.preference_cleared',
    null, jsonb_build_object('cleared', true), null
  );
  return p_recipe_id;
end $$;

create or replace function public.request_recipe_feedback(p_meal_plan_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_plan public.meal_plans%rowtype;
  v_actor uuid;
  v_mid uuid;
  v_count int := 0;
  v_rows int;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  select * into v_plan from public.meal_plans where id = p_meal_plan_id for update;
  if not found then raise exception 'Meal plan not found'; end if;
  v_actor := public._meal_active_membership(v_plan.household_id);
  if v_plan.recipe_id is null then return 0; end if;
  if v_plan.status <> 'prepared' then
    raise exception 'Feedback may only be requested after the meal is prepared';
  end if;

  for v_mid in
    select a.membership_id from public.meal_attendees a
    where a.meal_plan_id = p_meal_plan_id
      and a.attendance_status in ('going','maybe')
  loop
    insert into public.recipe_feedback_requests(
      household_id, meal_plan_id, recipe_id, membership_id, status
    ) values (
      v_plan.household_id, p_meal_plan_id, v_plan.recipe_id, v_mid, 'pending'
    )
    on conflict (meal_plan_id, membership_id) do nothing;
    get diagnostics v_rows = row_count;
    if v_rows > 0 then
      v_count := v_count + 1;
      perform public._meal_notify(
        v_plan.household_id,
        'recipe.feedback_requested',
        'meal_plan',
        p_meal_plan_id,
        v_actor,
        array[v_mid],
        'Optional recipe feedback',
        'Would you make this meal again?',
        '/app/' || v_plan.household_id::text || '/meals/' || p_meal_plan_id::text
      );
    end if;
  end loop;

  if v_count = 0 then
    insert into public.recipe_feedback_requests(
      household_id, meal_plan_id, recipe_id, membership_id, status
    ) values (
      v_plan.household_id, p_meal_plan_id, v_plan.recipe_id,
      v_plan.organizer_membership_id, 'pending'
    )
    on conflict (meal_plan_id, membership_id) do nothing;
    get diagnostics v_count = row_count;
  end if;

  perform public._meal_audit(
    v_plan.household_id, 'meal_plan', p_meal_plan_id, 'recipe.feedback_requested',
    null, jsonb_build_object('count', v_count), null
  );
  return v_count;
end $$;

create or replace function public.submit_recipe_feedback(
  p_feedback_request_id uuid,
  p_preference_signal text,
  p_is_favorite boolean default false,
  p_taste int default null,
  p_ease int default null,
  p_cost int default null,
  p_meal_prep_usefulness int default null,
  p_guest_friendliness int default null,
  p_private_note text default null,
  p_share_identity_with_organizer boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_req public.recipe_feedback_requests%rowtype;
  v_actor uuid;
  v_signal text;
  v_fav boolean;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  select * into v_req from public.recipe_feedback_requests where id = p_feedback_request_id for update;
  if not found then raise exception 'Feedback request not found'; end if;
  v_actor := public._meal_active_membership(v_req.household_id);
  if v_req.membership_id <> v_actor then
    raise exception 'Only the requested member may submit feedback';
  end if;
  if v_req.status not in ('pending') then
    raise exception 'Feedback request is no longer open';
  end if;
  if p_preference_signal not in (
    'favorite','would_make_again','okay','would_not_choose_again','have_not_tried'
  ) then
    raise exception 'Invalid preference signal';
  end if;

  v_fav := coalesce(p_is_favorite, false) or p_preference_signal = 'favorite';
  v_signal := case when v_fav then 'favorite' else p_preference_signal end;

  insert into public.recipe_feedback_responses(
    household_id, feedback_request_id, membership_id, preference_signal, is_favorite,
    taste, ease, cost, meal_prep_usefulness, guest_friendliness, private_note,
    share_identity_with_organizer
  ) values (
    v_req.household_id, p_feedback_request_id, v_actor, v_signal, v_fav,
    p_taste, p_ease, p_cost, p_meal_prep_usefulness, p_guest_friendliness,
    nullif(trim(coalesce(p_private_note,'')),''),
    coalesce(p_share_identity_with_organizer, false)
  );

  update public.recipe_feedback_requests
  set status = 'responded', responded_at = now()
  where id = p_feedback_request_id;

  perform public.set_recipe_preference(
    v_req.recipe_id, v_signal, v_fav, p_taste, p_ease, p_cost,
    p_meal_prep_usefulness, p_guest_friendliness, p_private_note,
    coalesce(p_share_identity_with_organizer, false)
  );

  perform public._meal_audit(
    v_req.household_id, 'recipe', v_req.recipe_id, 'recipe.feedback_submitted',
    null, jsonb_build_object('meal_plan_id', v_req.meal_plan_id), null
  );
  return p_feedback_request_id;
end $$;

create or replace function public.dismiss_recipe_feedback(p_feedback_request_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_req public.recipe_feedback_requests%rowtype; v_actor uuid;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  select * into v_req from public.recipe_feedback_requests where id = p_feedback_request_id for update;
  if not found then raise exception 'Feedback request not found'; end if;
  v_actor := public._meal_active_membership(v_req.household_id);
  if v_req.membership_id <> v_actor then
    raise exception 'Only the requested member may dismiss feedback';
  end if;
  if v_req.status = 'responded' then return p_feedback_request_id; end if;
  update public.recipe_feedback_requests
  set status = 'dismissed', dismissed_at = now()
  where id = p_feedback_request_id;
  perform public._meal_audit(
    v_req.household_id, 'recipe', v_req.recipe_id, 'recipe.feedback_dismissed',
    null, jsonb_build_object('meal_plan_id', v_req.meal_plan_id), null
  );
  return p_feedback_request_id;
end $$;
