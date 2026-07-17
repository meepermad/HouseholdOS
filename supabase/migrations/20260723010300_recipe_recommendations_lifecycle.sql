-- Phase 7A: preference-aware ranking lifecycle RPCs

create or replace function public.run_recipe_recommendation(p_meal_request_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_req public.meal_requests%rowtype;
  v_actor uuid;
  v_run_id uuid;
  v_recipe record;
  v_missing int;
  v_required int;
  v_use_soon int;
  v_available int;
  v_excludes text[];
  v_categories text[];
  v_equipment text[];
  v_dietary text[];
  v_guest_labels text[];
  v_attendee_ids uuid[];
  v_scope text;
  v_mode text;
  v_pref_score numeric;
  v_fav_count int;
  v_dislike_count int;
  v_make_again int;
  v_signal text;
  v_score numeric;
  v_ratio numeric;
  v_time_fit numeric;
  v_recent_pen numeric;
  v_cat_pen numeric;
  v_meal_prep numeric;
  v_guest_fit numeric;
  v_novelty numeric;
  v_reasons jsonb;
  v_warnings jsonb;
  v_fit text;
  v_result_id uuid;
  v_hash text;
  v_excluded boolean;
  v_exclude_reason text;
  v_days int;
  v_hist public.recipe_prep_history%rowtype;
  v_scale numeric;
  v_candidate_count int := 0;
  v_w_pantry numeric; v_w_use_soon numeric; v_w_missing numeric;
  v_w_pref numeric; v_w_dislike numeric; v_w_fav numeric;
  v_w_time numeric; v_w_recent numeric; v_w_cat numeric;
  v_w_prep numeric; v_w_guest numeric; v_w_shop numeric; v_w_novelty numeric;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  select * into v_req from public.meal_requests where id = p_meal_request_id for update;
  if not found then raise exception 'Meal request not found'; end if;
  v_actor := public._meal_active_membership(v_req.household_id);

  v_mode := coalesce(v_req.ranking_mode, 'best_overall');
  v_scope := coalesce(v_req.preference_scope, 'attendees');
  if v_req.meal_type = 'open_household' and v_scope = 'attendees' then
    -- open meals default to household preference unless organizer forced attendees
    v_scope := coalesce(nullif(v_req.preference_scope, 'attendees'), 'household');
    if v_req.preference_scope = 'attendees' then
      v_scope := 'attendees';
    else
      v_scope := 'household';
    end if;
  end if;

  select array_agg(value) into v_excludes from public.meal_request_constraints
    where meal_request_id = p_meal_request_id and constraint_type = 'exclude_ingredient';
  select array_agg(value) into v_categories from public.meal_request_constraints
    where meal_request_id = p_meal_request_id and constraint_type = 'category';
  select array_agg(value) into v_equipment from public.meal_request_constraints
    where meal_request_id = p_meal_request_id and constraint_type = 'equipment';
  select array_agg(value) into v_dietary from public.meal_request_constraints
    where meal_request_id = p_meal_request_id and constraint_type = 'dietary';
  select array_agg(label) into v_guest_labels from public.meal_request_guest_constraints
    where meal_request_id = p_meal_request_id;
  select array_agg(membership_id) into v_attendee_ids from public.meal_request_attendees
    where meal_request_id = p_meal_request_id;

  v_hash := md5(
    coalesce(v_mode,'') || '|' || coalesce(v_scope,'') || '|' ||
    coalesce(v_req.max_total_minutes::text,'') || '|' ||
    coalesce(v_req.max_missing_ingredients::text,'') || '|' ||
    coalesce(array_to_string(v_attendee_ids, ','), '') || '|' ||
    coalesce(array_to_string(v_excludes, ','), '') || '|' ||
    coalesce(v_req.desired_servings::text,'')
  );

  update public.recipe_recommendation_runs
  set status = 'superseded'
  where meal_request_id = p_meal_request_id and status = 'completed';

  insert into public.recipe_recommendation_runs(
    household_id, meal_request_id, requested_by_membership_id,
    ranking_mode, scoring_version, preference_scope, input_snapshot_hash, status
  ) values (
    v_req.household_id, p_meal_request_id, v_actor,
    v_mode, '1', v_scope, v_hash, 'running'
  ) returning id into v_run_id;

  delete from public.meal_request_results where meal_request_id = p_meal_request_id;

  v_w_pantry := public._recommendation_weight(v_mode, 'pantry_coverage');
  v_w_use_soon := public._recommendation_weight(v_mode, 'use_soon_utilization');
  v_w_missing := public._recommendation_weight(v_mode, 'missing_required_count');
  v_w_pref := public._recommendation_weight(v_mode, 'attendee_preference');
  v_w_dislike := public._recommendation_weight(v_mode, 'strong_dislike_penalty');
  v_w_fav := public._recommendation_weight(v_mode, 'favorite_bonus');
  v_w_time := public._recommendation_weight(v_mode, 'time_fit');
  v_w_recent := public._recommendation_weight(v_mode, 'recently_prepared_penalty');
  v_w_cat := public._recommendation_weight(v_mode, 'category_repetition_penalty');
  v_w_prep := public._recommendation_weight(v_mode, 'meal_prep_fit');
  v_w_guest := public._recommendation_weight(v_mode, 'guest_fit');
  v_w_shop := public._recommendation_weight(v_mode, 'shopping_cost_estimate');
  v_w_novelty := public._recommendation_weight(v_mode, 'novelty_bonus');

  for v_recipe in
    select r.* from public.recipes r
    where r.household_id = v_req.household_id
      and r.archived_at is null
      and public.can_view_recipe(r.id)
      and (v_categories is null or r.category = any(v_categories))
    order by r.name
    limit 100
  loop
    v_excluded := false;
    v_exclude_reason := null;
    v_reasons := '[]'::jsonb;
    v_warnings := '[]'::jsonb;
    v_fit := 'unknown';

    -- excluded ingredients
    if v_excludes is not null and exists (
      select 1 from public.recipe_ingredients ri
      where ri.recipe_id = v_recipe.id
        and ri.normalized_name in (
          select public._meal_normalize_name(x) from unnest(v_excludes) as x
        )
    ) then
      v_excluded := true;
      v_exclude_reason := 'Uses an ingredient explicitly excluded for this request';
    end if;

    -- dietary / guest hard constraints (label match against description/tags/ingredients)
    if not v_excluded and (
      (v_dietary is not null and exists (
        select 1 from unnest(v_dietary) d
        where lower(coalesce(v_recipe.description,'')) like '%' || lower(d) || '%'
           or lower(array_to_string(coalesce(v_recipe.tags,'{}'::text[]), ' ')) like '%' || lower(d) || '%'
           or exists (
             select 1 from public.recipe_ingredients ri
             where ri.recipe_id = v_recipe.id
               and ri.normalized_name = public._meal_normalize_name(d)
           )
      ))
      or (v_guest_labels is not null and exists (
        select 1 from unnest(v_guest_labels) g
        where exists (
          select 1 from public.recipe_ingredients ri
          where ri.recipe_id = v_recipe.id
            and (
              ri.normalized_name = public._meal_normalize_name(g)
              or ri.normalized_name like '%' || public._meal_normalize_name(g) || '%'
            )
        )
      ))
    ) then
      v_excluded := true;
      v_exclude_reason := 'Conflicts with a required attendee or guest dietary constraint';
    end if;

    -- equipment: hard-exclude when request listed available equipment and required item missing
    if not v_excluded and v_equipment is not null and exists (
      select 1 from public.recipe_equipment re
      where re.recipe_id = v_recipe.id and re.required = true
        and not exists (
          select 1 from unnest(v_equipment) e
          where lower(trim(e)) = lower(trim(re.display_name))
        )
    ) then
      v_excluded := true;
      v_exclude_reason := 'Requires unavailable essential equipment';
    end if;

    -- time
    if not v_excluded and v_req.max_total_minutes is not null
       and v_recipe.total_minutes is not null
       and v_recipe.total_minutes > v_req.max_total_minutes then
      v_excluded := true;
      v_exclude_reason := format('Exceeds maximum time of %s minutes', v_req.max_total_minutes);
    end if;

    select count(*)::int into v_required
    from public.recipe_ingredients ri
    where ri.recipe_id = v_recipe.id and ri.required = true;

    select count(*)::int into v_missing
    from public.recipe_ingredients ri
    where ri.recipe_id = v_recipe.id and ri.required = true
      and not exists (
        select 1 from public.pantry_items p
        where p.household_id = v_req.household_id
          and public.can_view_pantry_item(p.id)
          and p.normalized_name = ri.normalized_name
          and (p.communal_available = true or p.owner_membership_id = v_actor or p.ownership_mode = 'household')
          and p.state not in ('finished','discarded')
      );

    select count(*)::int into v_available
    from public.recipe_ingredients ri
    where ri.recipe_id = v_recipe.id and ri.required = true
      and exists (
        select 1 from public.pantry_items p
        where p.household_id = v_req.household_id
          and public.can_view_pantry_item(p.id)
          and p.normalized_name = ri.normalized_name
          and (p.communal_available = true or p.owner_membership_id = v_actor or p.ownership_mode = 'household')
          and p.state not in ('finished','discarded')
      );

    select count(*)::int into v_use_soon
    from public.recipe_ingredients ri
    join public.pantry_items p on p.household_id = v_req.household_id
      and p.normalized_name = ri.normalized_name
      and public.can_view_pantry_item(p.id)
      and p.state = 'use_soon'
    where ri.recipe_id = v_recipe.id;

    if not v_excluded and v_req.max_missing_ingredients is not null
       and v_missing > v_req.max_missing_ingredients then
      v_excluded := true;
      v_exclude_reason := format('Exceeds maximum missing required ingredients (%s)', v_req.max_missing_ingredients);
    end if;
    if not v_excluded and v_req.pantry_only and v_missing > 0 then
      v_excluded := true;
      v_exclude_reason := 'Exceeds maximum missing required ingredients (0)';
    end if;

    -- serving scale soft/hard
    v_scale := case
      when v_req.desired_servings is null or coalesce(v_recipe.base_servings,0) <= 0 then 1
      else v_req.desired_servings / v_recipe.base_servings
    end;
    if not v_excluded and v_scale > 4 then
      v_excluded := true;
      v_exclude_reason := 'Serving model cannot reasonably satisfy the target';
    end if;

    -- preference aggregation (attendee-scoped; anonymized explanations)
    v_pref_score := 0;
    v_fav_count := 0;
    v_dislike_count := 0;
    v_make_again := 0;

    for v_signal in
      select coalesce(p.preference_signal, 'have_not_tried')
      from public.recipe_user_preferences p
      where p.recipe_id = v_recipe.id
        and p.household_id = v_req.household_id
        and (
          v_scope = 'household'
          or (
            v_attendee_ids is not null and p.membership_id = any(v_attendee_ids)
          )
          or (
            v_attendee_ids is null and v_scope = 'attendees'
            -- no attendees listed: treat as organizer-only / neutral household open set
            and false
          )
        )
    loop
      if v_signal = 'favorite' then
        v_pref_score := v_pref_score + 18; v_fav_count := v_fav_count + 1; v_make_again := v_make_again + 1;
      elsif v_signal = 'would_make_again' then
        v_pref_score := v_pref_score + 12; v_make_again := v_make_again + 1;
      elsif v_signal = 'okay' then
        v_pref_score := v_pref_score + 2;
      elsif v_signal = 'would_not_choose_again' then
        v_pref_score := v_pref_score - 20; v_dislike_count := v_dislike_count + 1;
      end if;
    end loop;

    if v_fav_count > 0 and v_dislike_count > 0 then
      v_fit := 'conflict';
    elsif v_dislike_count > 0 and v_make_again = 0 then
      v_fit := 'negative';
    elsif v_dislike_count > 0 then
      v_fit := 'mixed';
    elsif v_fav_count > 0 or v_make_again >= 2 then
      v_fit := 'strong';
    elsif v_make_again = 1 then
      v_fit := 'positive';
    elsif v_pref_score = 0 then
      v_fit := 'unknown';
    else
      v_fit := 'neutral';
    end if;

    select * into v_hist from public.recipe_prep_history
    where recipe_id = v_recipe.id and household_id = v_req.household_id;

    v_ratio := case when greatest(v_required,1) = 0 then 0 else v_available::numeric / greatest(v_required,1) end;
    v_time_fit := greatest(0, 15 - floor(coalesce(v_recipe.total_minutes,60) / 10.0));
    v_recent_pen := 0;
    if v_hist.last_prepared_at is not null then
      v_days := floor(extract(epoch from (now() - v_hist.last_prepared_at)) / 86400.0)::int;
      if v_mode = 'something_different' and v_days < 21 then
        v_recent_pen := 1 + ((21 - v_days)::numeric / 21);
      elsif v_days < 7 then
        v_recent_pen := 1;
      end if;
    end if;
    v_cat_pen := greatest(0, coalesce(v_hist.recent_category_count,0) - 1);
    v_meal_prep := case when v_recipe.category = 'meal_prep' or v_req.meal_type = 'meal_prep' then 1 else 0 end;
    if coalesce(v_hist.last_used_for_meal_prep, false) then v_meal_prep := v_meal_prep + 0.5; end if;
    v_guest_fit := case when coalesce(v_hist.last_successful_for_guests, false) then 1 else 0.5 end;
    v_novelty := case
      when coalesce(v_hist.times_prepared,0) = 0 and v_recipe.source_type = 'imported' then 0
      when coalesce(v_hist.times_prepared,0) = 0 then 1
      else 0
    end;

    if not v_excluded then
      v_score :=
        round((v_ratio * v_w_pantry)::numeric, 2)
        + round((v_use_soon * v_w_use_soon)::numeric, 2)
        + round((least(v_missing, 4) * v_w_missing)::numeric, 2)
        + round((v_pref_score * v_w_pref)::numeric, 2)
        + round((v_dislike_count * v_w_dislike)::numeric, 2)
        + round((v_fav_count * v_w_fav)::numeric, 2)
        + round((v_time_fit * v_w_time)::numeric, 2)
        + round((v_recent_pen * v_w_recent)::numeric, 2)
        + round((v_cat_pen * v_w_cat)::numeric, 2)
        + round((v_meal_prep * v_w_prep)::numeric, 2)
        + round((v_guest_fit * v_w_guest)::numeric, 2)
        + round((v_missing * v_w_shop)::numeric, 2)
        + round((v_novelty * v_w_novelty)::numeric, 2);

      if v_ratio >= 0.75 then
        v_reasons := v_reasons || jsonb_build_array(format('%s of %s required ingredients appear available', v_available, greatest(v_required,1)));
      end if;
      if v_use_soon > 0 then
        v_reasons := v_reasons || jsonb_build_array(format('Uses %s ingredient(s) marked “use soon”', v_use_soon));
      end if;
      if v_missing = 0 then
        v_reasons := v_reasons || jsonb_build_array('No required ingredients missing');
      elsif v_missing = 1 then
        v_reasons := v_reasons || jsonb_build_array('Missing only one required ingredient');
      else
        v_reasons := v_reasons || jsonb_build_array(format('Missing %s required ingredients', v_missing));
      end if;
      if v_make_again = 1 then
        v_reasons := v_reasons || jsonb_build_array('One attending member marked it “would make again”');
      elsif v_make_again > 1 then
        v_reasons := v_reasons || jsonb_build_array(format('%s attending members marked it “would make again”', v_make_again));
      end if;
      if v_fav_count > 0 then
        v_reasons := v_reasons || jsonb_build_array(
          case when v_fav_count = 1 then 'One attending member marked it as a favorite'
               else format('%s attending members marked it as a favorite', v_fav_count) end
        );
      end if;
      if v_dislike_count > 0 then
        v_warnings := v_warnings || jsonb_build_array(
          case when v_dislike_count = 1 then 'One attending member marked this “would not choose again.”'
               else format('%s attending members marked this “would not choose again.”', v_dislike_count) end
        );
      end if;
      if v_fit in ('mixed','conflict') then
        v_reasons := v_reasons || jsonb_build_array('Preference fit: Mixed');
        v_warnings := v_warnings || jsonb_build_array('Preference fit: Mixed');
      end if;
      if v_recipe.total_minutes is not null then
        v_reasons := v_reasons || jsonb_build_array(format('Estimated total time is %s minutes', v_recipe.total_minutes));
      end if;
      if v_hist.last_prepared_at is not null and v_days is not null and v_days >= 21 then
        v_reasons := v_reasons || jsonb_build_array(format('It has not been prepared in %s weeks', greatest(1, floor(v_days/7.0)::int)));
      elsif v_recent_pen > 0 then
        v_reasons := v_reasons || jsonb_build_array(format('Recently prepared (%s days ago)', coalesce(v_days,0)));
      end if;
    else
      v_score := 0;
    end if;

    insert into public.recipe_recommendation_results(
      run_id, household_id, recipe_id, total_score, explanation, warnings,
      hard_exclusion_reason, pantry_coverage_summary, preference_fit_summary,
      missing_required, excluded
    ) values (
      v_run_id, v_req.household_id, v_recipe.id, coalesce(v_score,0),
      coalesce(v_reasons,'[]'::jsonb), coalesce(v_warnings,'[]'::jsonb),
      v_exclude_reason,
      jsonb_build_object(
        'available', v_available, 'required', greatest(v_required,1),
        'ratio', round(v_ratio::numeric, 4), 'use_soon', v_use_soon
      ),
      v_fit, coalesce(v_missing,0), v_excluded
    ) returning id into v_result_id;

    if not v_excluded then
      insert into public.recipe_recommendation_score_components(result_id, household_id, component_key, value, weight, contribution)
      values
        (v_result_id, v_req.household_id, 'pantry_coverage', v_ratio, v_w_pantry, round((v_ratio*v_w_pantry)::numeric,2)),
        (v_result_id, v_req.household_id, 'use_soon_utilization', v_use_soon, v_w_use_soon, round((v_use_soon*v_w_use_soon)::numeric,2)),
        (v_result_id, v_req.household_id, 'missing_required_count', least(v_missing,4), v_w_missing, round((least(v_missing,4)*v_w_missing)::numeric,2)),
        (v_result_id, v_req.household_id, 'attendee_preference', v_pref_score, v_w_pref, round((v_pref_score*v_w_pref)::numeric,2)),
        (v_result_id, v_req.household_id, 'strong_dislike_penalty', v_dislike_count, v_w_dislike, round((v_dislike_count*v_w_dislike)::numeric,2)),
        (v_result_id, v_req.household_id, 'favorite_bonus', v_fav_count, v_w_fav, round((v_fav_count*v_w_fav)::numeric,2)),
        (v_result_id, v_req.household_id, 'time_fit', v_time_fit, v_w_time, round((v_time_fit*v_w_time)::numeric,2)),
        (v_result_id, v_req.household_id, 'recently_prepared_penalty', v_recent_pen, v_w_recent, round((v_recent_pen*v_w_recent)::numeric,2)),
        (v_result_id, v_req.household_id, 'category_repetition_penalty', v_cat_pen, v_w_cat, round((v_cat_pen*v_w_cat)::numeric,2)),
        (v_result_id, v_req.household_id, 'meal_prep_fit', v_meal_prep, v_w_prep, round((v_meal_prep*v_w_prep)::numeric,2)),
        (v_result_id, v_req.household_id, 'guest_fit', v_guest_fit, v_w_guest, round((v_guest_fit*v_w_guest)::numeric,2)),
        (v_result_id, v_req.household_id, 'shopping_cost_estimate', v_missing, v_w_shop, round((v_missing*v_w_shop)::numeric,2)),
        (v_result_id, v_req.household_id, 'novelty_bonus', v_novelty, v_w_novelty, round((v_novelty*v_w_novelty)::numeric,2));

      v_candidate_count := v_candidate_count + 1;
      insert into public.meal_request_results(
        meal_request_id, household_id, recipe_id, rank_position, score, explanation,
        missing_required, warnings, preference_fit_summary, recommendation_run_id, pantry_coverage_ratio
      ) values (
        p_meal_request_id, v_req.household_id, v_recipe.id, 1, v_score, v_reasons,
        v_missing, v_warnings, v_fit, v_run_id, v_ratio
      );
    end if;
  end loop;

  with ordered as (
    select id, row_number() over (order by score desc, recipe_id) as rn
    from public.meal_request_results where meal_request_id = p_meal_request_id
  )
  update public.meal_request_results r set rank_position = ordered.rn
  from ordered where r.id = ordered.id;

  with ordered as (
    select id, row_number() over (
      order by excluded asc, total_score desc, recipe_id
    ) as rn
    from public.recipe_recommendation_results where run_id = v_run_id and excluded = false
  )
  update public.recipe_recommendation_results r set rank_position = ordered.rn
  from ordered where r.id = ordered.id;

  update public.recipe_recommendation_runs
  set status = 'completed', candidate_count = v_candidate_count
  where id = v_run_id;

  update public.meal_requests
  set status = 'ranked', last_recommendation_run_id = v_run_id, inputs_changed_at = null
  where id = p_meal_request_id;

  perform public._meal_audit(
    v_req.household_id, 'meal_request', p_meal_request_id, 'meal.recommendation_run',
    null, jsonb_build_object('run_id', v_run_id, 'scoring_version', '1', 'candidates', v_candidate_count), null
  );

  return v_run_id;
end $$;

-- Keep legacy name as wrapper
create or replace function public.rank_recipe_candidates(p_meal_request_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_run uuid; v_count int;
begin
  v_run := public.run_recipe_recommendation(p_meal_request_id);
  select candidate_count into v_count from public.recipe_recommendation_runs where id = v_run;
  return coalesce(v_count, 0);
end $$;

create or replace function public.get_recipe_recommendation_results(p_meal_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_req public.meal_requests%rowtype;
  v_actor uuid;
  v_run_id uuid;
  v_out jsonb;
begin
  select * into v_req from public.meal_requests where id = p_meal_request_id;
  if not found then raise exception 'Meal request not found'; end if;
  v_actor := public._meal_active_membership(v_req.household_id);
  v_run_id := v_req.last_recommendation_run_id;
  if v_run_id is null then
    select id into v_run_id from public.recipe_recommendation_runs
    where meal_request_id = p_meal_request_id and status = 'completed'
    order by created_at desc limit 1;
  end if;
  if v_run_id is null then
    return jsonb_build_object('run_id', null, 'results', '[]'::jsonb, 'inputs_changed', v_req.inputs_changed_at is not null);
  end if;

  select jsonb_build_object(
    'run_id', v_run_id,
    'scoring_version', r.scoring_version,
    'ranking_mode', r.ranking_mode,
    'preference_scope', r.preference_scope,
    'inputs_changed', v_req.inputs_changed_at is not null,
    'inputs_changed_message', case when v_req.inputs_changed_at is not null and v_req.status = 'accepted'
      then 'Recommendation inputs changed. Review updated pantry and shopping requirements.'
      else null end,
    'results', coalesce((
      select jsonb_agg(jsonb_build_object(
        'recipe_id', res.recipe_id,
        'rank', res.rank_position,
        'score', res.total_score,
        'explanation', res.explanation,
        'warnings', res.warnings,
        'preference_fit', res.preference_fit_summary,
        'pantry_coverage', res.pantry_coverage_summary,
        'missing_required', res.missing_required,
        'components', coalesce((
          select jsonb_agg(jsonb_build_object(
            'key', c.component_key,
            'value', c.value,
            'weight', c.weight,
            'contribution', c.contribution
          ) order by c.component_key)
          from public.recipe_recommendation_score_components c
          where c.result_id = res.id
        ), '[]'::jsonb)
      ) order by res.rank_position)
      from public.recipe_recommendation_results res
      where res.run_id = v_run_id and res.excluded = false and public.can_view_recipe(res.recipe_id)
    ), '[]'::jsonb)
  ) into v_out
  from public.recipe_recommendation_runs r where r.id = v_run_id;

  return v_out;
end $$;

create or replace function public.accept_recipe_recommendation(
  p_meal_request_id uuid,
  p_recipe_id uuid,
  p_meal_date date,
  p_desired_servings numeric default null,
  p_link_calendar boolean default false,
  p_attendee_membership_ids uuid[] default '{}'
) returns uuid language plpgsql security definer set search_path = public as $$
begin
  return public.accept_meal_request_result(
    p_meal_request_id, p_recipe_id, p_meal_date, p_desired_servings,
    p_link_calendar, p_attendee_membership_ids
  );
end $$;

create or replace function public.recalculate_meal_recommendation_context(p_meal_request_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_req public.meal_requests%rowtype; v_actor uuid; v_run uuid;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  select * into v_req from public.meal_requests where id = p_meal_request_id for update;
  if not found then raise exception 'Meal request not found'; end if;
  v_actor := public._meal_active_membership(v_req.household_id);

  if v_req.status = 'accepted' then
    update public.meal_requests set inputs_changed_at = now() where id = p_meal_request_id;
    -- Do not auto-replace accepted meal plan recipe
    perform public._meal_audit(
      v_req.household_id, 'meal_request', p_meal_request_id, 'meal.recommendation_inputs_changed',
      null, jsonb_build_object('accepted', true), null
    );
    return v_req.last_recommendation_run_id;
  end if;

  v_run := public.run_recipe_recommendation(p_meal_request_id);
  return v_run;
end $$;
