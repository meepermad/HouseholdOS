-- Phase 6.5: meal request ranking, shopping prep, prepare/batch RPCs

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
  p_constraints jsonb default '[]'::jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_actor uuid; v_id uuid; v_c jsonb;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  v_actor := public._meal_active_membership(p_household_id);
  insert into public.meal_requests(
    household_id, created_by_membership_id, meal_type, target_date, guest_count,
    desired_servings, max_total_minutes, max_missing_ingredients, pantry_only, note, status
  ) values (
    p_household_id, v_actor, p_meal_type, p_target_date, coalesce(p_guest_count,0),
    p_desired_servings, p_max_total_minutes, p_max_missing_ingredients,
    coalesce(p_pantry_only,false), nullif(trim(coalesce(p_note,'')),''), 'open'
  ) returning id into v_id;
  for v_c in select * from jsonb_array_elements(coalesce(p_constraints,'[]'::jsonb))
  loop
    insert into public.meal_request_constraints(meal_request_id, household_id, constraint_type, value)
    values (v_id, p_household_id, v_c->>'constraint_type', trim(v_c->>'value'));
  end loop;
  perform public._meal_audit(p_household_id, 'meal_request', v_id, 'meal.request_created');
  -- Ranking does NOT mutate shopping lists.
  perform public.rank_recipe_candidates(v_id);
  return v_id;
end $$;

create or replace function public.rank_recipe_candidates(p_meal_request_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_req public.meal_requests%rowtype;
  v_actor uuid;
  v_recipe record;
  v_rank int := 0;
  v_score numeric;
  v_missing int;
  v_excludes text[];
  v_categories text[];
  v_reasons jsonb;
  v_use_soon int;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  select * into v_req from public.meal_requests where id = p_meal_request_id for update;
  if not found then raise exception 'Meal request not found'; end if;
  v_actor := public._meal_active_membership(v_req.household_id);

  select array_agg(value) into v_excludes from public.meal_request_constraints
    where meal_request_id = p_meal_request_id and constraint_type = 'exclude_ingredient';
  select array_agg(value) into v_categories from public.meal_request_constraints
    where meal_request_id = p_meal_request_id and constraint_type = 'category';

  delete from public.meal_request_results where meal_request_id = p_meal_request_id;

  for v_recipe in
    select r.* from public.recipes r
    where r.household_id = v_req.household_id
      and r.archived_at is null
      and public.can_view_recipe(r.id)
      and (v_req.max_total_minutes is null or r.total_minutes is null or r.total_minutes <= v_req.max_total_minutes)
      and (v_categories is null or r.category = any(v_categories))
    order by r.name
    limit 100
  loop
    if v_excludes is not null and exists (
      select 1 from public.recipe_ingredients ri
      where ri.recipe_id = v_recipe.id
        and ri.normalized_name in (
          select public._meal_normalize_name(x) from unnest(v_excludes) as x
        )
    ) then
      continue;
    end if;

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

    select count(*)::int into v_use_soon
    from public.recipe_ingredients ri
    join public.pantry_items p on p.household_id = v_req.household_id
      and p.normalized_name = ri.normalized_name
      and public.can_view_pantry_item(p.id)
      and p.state = 'use_soon'
    where ri.recipe_id = v_recipe.id;

    if v_req.max_missing_ingredients is not null and v_missing > v_req.max_missing_ingredients then
      continue;
    end if;
    if v_req.pantry_only and v_missing > 0 then
      continue;
    end if;

    v_score := greatest(0, 40 - (v_missing * 5)) + (v_use_soon * 8)
      + coalesce(greatest(0, 15 - floor(coalesce(v_recipe.total_minutes,60) / 10.0)), 0);
    v_reasons := jsonb_build_array();
    if v_use_soon > 0 then
      v_reasons := v_reasons || jsonb_build_array(format('Uses %s ingredient(s) marked “use soon”', v_use_soon));
    end if;
    v_reasons := v_reasons || jsonb_build_array(format('Missing %s required ingredients', v_missing));
    if v_recipe.total_minutes is not null then
      v_reasons := v_reasons || jsonb_build_array(format('Estimated total time: %s minutes', v_recipe.total_minutes));
    end if;

    v_rank := v_rank + 1;
    insert into public.meal_request_results(
      meal_request_id, household_id, recipe_id, rank_position, score, explanation, missing_required
    ) values (p_meal_request_id, v_req.household_id, v_recipe.id, v_rank, v_score, v_reasons, v_missing);
  end loop;

  with ordered as (
    select id, row_number() over (order by score desc, recipe_id) as rn
    from public.meal_request_results where meal_request_id = p_meal_request_id
  )
  update public.meal_request_results r set rank_position = ordered.rn
  from ordered where r.id = ordered.id;

  update public.meal_requests set status = 'ranked' where id = p_meal_request_id;
  return v_rank;
end $$;

create or replace function public.dismiss_meal_request(p_meal_request_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_req public.meal_requests%rowtype; v_actor uuid;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  select * into v_req from public.meal_requests where id = p_meal_request_id for update;
  if not found then raise exception 'Meal request not found'; end if;
  v_actor := public._meal_active_membership(v_req.household_id);
  if v_req.created_by_membership_id <> v_actor then raise exception 'Only the requester may dismiss'; end if;
  update public.meal_requests set status = 'dismissed' where id = p_meal_request_id;
  return p_meal_request_id;
end $$;

create or replace function public.build_meal_shopping_proposal(p_meal_plan_id uuid, p_shopping_list_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_plan public.meal_plans%rowtype;
  v_actor uuid;
  v_settings public.household_meal_settings;
  v_proposal_id uuid;
  v_ing record;
  v_status text;
  v_shortfall numeric;
  v_excluded boolean;
  v_ord int := 0;
  v_existing uuid;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  select * into v_plan from public.meal_plans where id = p_meal_plan_id for update;
  if not found then raise exception 'Meal plan not found'; end if;
  v_actor := public._meal_active_membership(v_plan.household_id);
  if v_plan.organizer_membership_id <> v_actor and v_plan.created_by_membership_id <> v_actor then
    raise exception 'Only the organizer may build shopping prep';
  end if;
  v_settings := public._ensure_meal_settings(v_plan.household_id);

  update public.meal_shopping_proposals set status = 'superseded'
  where meal_plan_id = p_meal_plan_id and status = 'draft';

  insert into public.meal_shopping_proposals(
    household_id, meal_plan_id, meal_request_id, status, shopping_list_id,
    policy_snapshot, created_by_membership_id
  ) values (
    v_plan.household_id, p_meal_plan_id, v_plan.meal_request_id, 'draft',
    coalesce(p_shopping_list_id, public.ensure_default_shopping_list(v_plan.household_id)),
    v_settings.shopping_prep_policy, v_actor
  ) returning id into v_proposal_id;

  for v_ing in
    select * from public.meal_plan_ingredients where meal_plan_id = p_meal_plan_id order by sort_order
  loop
    v_shortfall := null;
    v_excluded := false;
    if not v_ing.required then
      v_status := 'optional';
      v_excluded := true;
    elsif exists (
      select 1 from public.shopping_list_items s
      where s.related_meal_plan_id = p_meal_plan_id
        and s.related_recipe_ingredient_id = v_ing.recipe_ingredient_id
        and s.status = 'purchased'
    ) then
      v_status := 'already_on_shopping_list';
      v_excluded := true;
    elsif exists (
      select 1 from public.shopping_list_items s
      where s.related_meal_plan_id = p_meal_plan_id
        and s.related_recipe_ingredient_id = v_ing.recipe_ingredient_id
        and s.status in ('requested','approved','assigned','in_cart')
    ) then
      v_status := 'already_on_shopping_list';
      v_excluded := false;
    elsif v_ing.pantry_match_status in ('available','assumed_available','use_soon') then
      v_status := 'available';
      v_excluded := true;
    elsif v_ing.pantry_match_status = 'probably_available' then
      v_status := 'probably_available';
      v_excluded := true;
    elsif v_ing.pantry_match_status = 'unit_mismatch' then
      v_status := 'needs_unit_review';
      v_excluded := true;
    elsif v_ing.pantry_match_status = 'personal_unavailable' then
      v_status := 'unavailable_personal_item';
      v_shortfall := v_ing.scaled_quantity;
    elsif v_ing.pantry_match_status = 'low' then
      v_status := 'insufficient_quantity';
      v_shortfall := coalesce(v_ing.pantry_shortfall_quantity, v_ing.scaled_quantity);
    else
      v_status := 'missing';
      v_shortfall := v_ing.scaled_quantity;
    end if;

    insert into public.meal_shopping_proposal_lines(
      proposal_id, household_id, recipe_ingredient_id, display_name, line_status,
      required_quantity, shortfall_quantity, quantity_unit, excluded, sort_order
    ) values (
      v_proposal_id, v_plan.household_id, v_ing.recipe_ingredient_id, v_ing.display_name, v_status,
      v_ing.scaled_quantity, v_shortfall, v_ing.quantity_unit, v_excluded, v_ord
    );
    v_ord := v_ord + 1;
  end loop;

  return v_proposal_id;
end $$;

create or replace function public.confirm_meal_shopping_proposal(
  p_proposal_id uuid,
  p_excluded_line_ids uuid[] default '{}',
  p_quantity_overrides jsonb default '{}'::jsonb,
  p_shopping_list_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_prop public.meal_shopping_proposals%rowtype;
  v_plan public.meal_plans%rowtype;
  v_actor uuid;
  v_line record;
  v_list uuid;
  v_qty numeric;
  v_item_id uuid;
  v_name text;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  perform set_config('householdos.resource_mutation', 'rpc', true);
  select * into v_prop from public.meal_shopping_proposals where id = p_proposal_id for update;
  if not found then raise exception 'Shopping proposal not found'; end if;
  if v_prop.status <> 'draft' then raise exception 'Proposal is not draft'; end if;
  select * into v_plan from public.meal_plans where id = v_prop.meal_plan_id;
  v_actor := public._meal_active_membership(v_prop.household_id);
  if v_plan.organizer_membership_id <> v_actor and v_plan.created_by_membership_id <> v_actor then
    raise exception 'Only the organizer may confirm shopping prep';
  end if;
  v_list := coalesce(p_shopping_list_id, v_prop.shopping_list_id, public.ensure_default_shopping_list(v_prop.household_id));

  for v_line in select * from public.meal_shopping_proposal_lines where proposal_id = p_proposal_id
  loop
    if v_line.id = any(coalesce(p_excluded_line_ids, '{}'::uuid[])) or v_line.excluded then
      update public.meal_shopping_proposal_lines set excluded = true where id = v_line.id;
      continue;
    end if;
    if v_line.line_status in ('available','optional','probably_available') then
      continue;
    end if;
    -- Never touch purchased
    if exists (
      select 1 from public.shopping_list_items s
      where s.related_meal_plan_id = v_plan.id
        and s.related_recipe_ingredient_id = v_line.recipe_ingredient_id
        and s.status = 'purchased'
    ) then
      continue;
    end if;

    v_qty := coalesce(
      nullif(p_quantity_overrides->>v_line.id::text,'')::numeric,
      v_line.shortfall_quantity,
      v_line.required_quantity
    );
    v_name := coalesce(v_line.substitute_name, v_line.display_name);

    select id into v_item_id from public.shopping_list_items
    where related_meal_plan_id = v_plan.id
      and related_recipe_ingredient_id = v_line.recipe_ingredient_id
      and status in ('requested','approved','assigned','in_cart')
    limit 1;

    if v_item_id is not null then
      update public.shopping_list_items set
        quantity = v_qty,
        pantry_shortfall_quantity = v_qty,
        required_quantity = v_line.required_quantity,
        name = v_name,
        updated_at = now()
      where id = v_item_id;
    else
      insert into public.shopping_list_items(
        list_id, household_id, name, category, requested_by_membership_id,
        quantity, quantity_unit, quantity_is_approximate, status,
        related_meal_request_id, related_meal_plan_id, related_recipe_id,
        related_recipe_ingredient_id, required_quantity, pantry_shortfall_quantity
      ) values (
        v_list, v_prop.household_id, v_name, 'groceries', v_actor,
        v_qty, v_line.quantity_unit, true, 'requested',
        v_plan.meal_request_id, v_plan.id, v_plan.recipe_id,
        v_line.recipe_ingredient_id, v_line.required_quantity, v_qty
      ) returning id into v_item_id;
    end if;

    update public.meal_shopping_proposal_lines set shopping_list_item_id = v_item_id where id = v_line.id;
    update public.meal_plan_ingredients set
      shopping_list_item_id = v_item_id,
      checklist_status = 'on_shopping_list',
      pantry_shortfall_quantity = v_qty
    where meal_plan_id = v_plan.id and recipe_ingredient_id is not distinct from v_line.recipe_ingredient_id;
  end loop;

  update public.meal_shopping_proposals set status = 'confirmed', confirmed_at = now(), shopping_list_id = v_list
  where id = p_proposal_id;
  update public.meal_plans set status = 'shopping_needed' where id = v_plan.id and status in ('draft','planned','ready');
  perform public._meal_audit(v_prop.household_id, 'meal_shopping_proposal', p_proposal_id, 'meal.shopping_needed');
  perform public._meal_notify(
    v_prop.household_id, 'meal.shopping_needed', 'meal_plan', v_plan.id, v_actor,
    array[v_actor],
    'Shopping needed for meal', 'Missing ingredients were added to the shopping list.',
    '/app/' || v_prop.household_id::text || '/meals/' || v_plan.id::text || '/shopping'
  );
  return p_proposal_id;
end $$;

create or replace function public.recalculate_meal_shopping_prep(p_meal_plan_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_proposal_id uuid; v_settings public.household_meal_settings; v_plan public.meal_plans%rowtype;
begin
  select * into v_plan from public.meal_plans where id = p_meal_plan_id;
  if not found then raise exception 'Meal plan not found'; end if;
  v_settings := public._ensure_meal_settings(v_plan.household_id);
  v_proposal_id := public.build_meal_shopping_proposal(p_meal_plan_id);
  if v_settings.shopping_prep_policy = 'automatic_on_acceptance' then
    perform public.confirm_meal_shopping_proposal(v_proposal_id);
  end if;
  return v_proposal_id;
end $$;

create or replace function public.accept_meal_request_result(
  p_meal_request_id uuid,
  p_recipe_id uuid,
  p_meal_date date default null,
  p_target_servings numeric default null,
  p_link_calendar boolean default false,
  p_attendee_membership_ids uuid[] default '{}'
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_req public.meal_requests%rowtype;
  v_actor uuid;
  v_plan_id uuid;
  v_settings public.household_meal_settings;
  v_proposal_id uuid;
  v_date date;
  v_servings numeric;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  select * into v_req from public.meal_requests where id = p_meal_request_id for update;
  if not found then raise exception 'Meal request not found'; end if;
  v_actor := public._meal_active_membership(v_req.household_id);
  if v_req.created_by_membership_id <> v_actor then
    raise exception 'Only the requester may accept a result';
  end if;
  if not exists (
    select 1 from public.meal_request_results
    where meal_request_id = p_meal_request_id and recipe_id = p_recipe_id
  ) then raise exception 'Recipe is not a ranked result for this request'; end if;
  if not public.can_view_recipe(p_recipe_id) then raise exception 'Recipe not visible'; end if;

  v_date := coalesce(p_meal_date, v_req.target_date, current_date);
  v_servings := coalesce(p_target_servings, v_req.desired_servings, 4);
  v_settings := public._ensure_meal_settings(v_req.household_id);

  v_plan_id := public.create_meal_plan(
    v_req.household_id,
    v_req.meal_type,
    (select name from public.recipes where id = p_recipe_id),
    v_date,
    p_recipe_id,
    null,
    v_servings,
    0, 0,
    v_req.guest_count,
    null,
    p_attendee_membership_ids,
    p_link_calendar,
    null, null, null, 'manual',
    p_meal_request_id
  );

  update public.meal_requests set status = 'accepted', accepted_meal_plan_id = v_plan_id where id = p_meal_request_id;

  -- Match pantry onto meal plan ingredients (authorized projection only)
  update public.meal_plan_ingredients mpi set
    pantry_match_status = case
      when exists (
        select 1 from public.pantry_items p
        where p.household_id = v_req.household_id
          and public.can_view_pantry_item(p.id)
          and p.normalized_name = mpi.normalized_name
          and (p.communal_available or p.ownership_mode = 'household' or p.owner_membership_id = v_actor)
          and p.state = 'use_soon'
      ) then 'use_soon'
      when exists (
        select 1 from public.pantry_items p
        where p.household_id = v_req.household_id
          and public.can_view_pantry_item(p.id)
          and p.normalized_name = mpi.normalized_name
          and (p.communal_available or p.ownership_mode = 'household' or p.owner_membership_id = v_actor)
          and p.state not in ('finished','discarded')
          and p.quantity is not null and mpi.scaled_quantity is not null
          and p.quantity_unit = mpi.quantity_unit
          and p.quantity >= mpi.scaled_quantity
          and p.quantity_is_approximate = false
      ) then 'available'
      when exists (
        select 1 from public.pantry_items p
        where p.household_id = v_req.household_id
          and public.can_view_pantry_item(p.id)
          and p.normalized_name = mpi.normalized_name
          and (p.communal_available or p.ownership_mode = 'household' or p.owner_membership_id = v_actor)
          and p.state not in ('finished','discarded')
      ) then 'probably_available'
      when exists (
        select 1 from public.pantry_items p
        where p.household_id = v_req.household_id
          and p.normalized_name = mpi.normalized_name
          and not public.can_view_pantry_item(p.id)
      ) then 'personal_unavailable'
      else 'missing'
    end,
    pantry_item_id = (
      select p.id from public.pantry_items p
      where p.household_id = v_req.household_id
        and public.can_view_pantry_item(p.id)
        and p.normalized_name = mpi.normalized_name
      limit 1
    )
  where mpi.meal_plan_id = v_plan_id;

  v_proposal_id := public.build_meal_shopping_proposal(v_plan_id);
  if v_settings.shopping_prep_policy = 'automatic_on_acceptance' then
    perform public.confirm_meal_shopping_proposal(v_proposal_id);
  end if;

  return v_plan_id;
end $$;

create or replace function public.mark_meal_preparing(p_meal_plan_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_plan public.meal_plans%rowtype; v_actor uuid;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  select * into v_plan from public.meal_plans where id = p_meal_plan_id for update;
  if not found then raise exception 'Meal plan not found'; end if;
  v_actor := public._meal_active_membership(v_plan.household_id);
  if v_plan.organizer_membership_id <> v_actor and v_plan.cooking_membership_id is distinct from v_actor then
    raise exception 'Not allowed to mark preparing';
  end if;
  update public.meal_plans set status = 'preparing' where id = p_meal_plan_id;
  perform public._meal_audit(v_plan.household_id, 'meal_plan', p_meal_plan_id, 'meal.preparing');
  return p_meal_plan_id;
end $$;

create or replace function public.mark_meal_prepared(
  p_meal_plan_id uuid,
  p_create_batch boolean default true,
  p_batch_quantity numeric default null,
  p_remaining_state text default 'plenty',
  p_location_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_plan public.meal_plans%rowtype; v_actor uuid; v_batch_id uuid;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  select * into v_plan from public.meal_plans where id = p_meal_plan_id for update;
  if not found then raise exception 'Meal plan not found'; end if;
  v_actor := public._meal_active_membership(v_plan.household_id);
  if v_plan.organizer_membership_id <> v_actor and v_plan.cooking_membership_id is distinct from v_actor then
    raise exception 'Not allowed to mark prepared';
  end if;
  if v_plan.status = 'prepared' then
    -- idempotent
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

  perform public._meal_audit(v_plan.household_id, 'meal_plan', p_meal_plan_id, 'meal.prepared');
  if v_plan.meal_type <> 'personal' then
    perform public._meal_notify(
      v_plan.household_id, 'meal.prepared', 'meal_plan', p_meal_plan_id, v_actor,
      (select array_agg(a.membership_id) from public.meal_attendees a
       where a.meal_plan_id = p_meal_plan_id and a.attendance_status = 'going'),
      'Meal prepared', 'A planned meal was marked prepared.',
      '/app/' || v_plan.household_id::text || '/meals/' || p_meal_plan_id::text
    );
  end if;
  return coalesce(v_batch_id, p_meal_plan_id);
end $$;

create or replace function public.confirm_meal_pantry_usage(
  p_meal_plan_id uuid,
  p_usage jsonb default '[]'::jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_plan public.meal_plans%rowtype;
  v_actor uuid;
  v_row jsonb;
  v_pantry_id uuid;
  v_qty numeric;
  v_idem text;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  perform set_config('householdos.resource_mutation', 'rpc', true);
  select * into v_plan from public.meal_plans where id = p_meal_plan_id for update;
  if not found then raise exception 'Meal plan not found'; end if;
  v_actor := public._meal_active_membership(v_plan.household_id);
  if v_plan.organizer_membership_id <> v_actor then
    raise exception 'Only the organizer may confirm pantry usage';
  end if;

  for v_row in select * from jsonb_array_elements(coalesce(p_usage,'[]'::jsonb))
  loop
    if coalesce((v_row->>'skip')::boolean, false) then continue; end if;
    v_pantry_id := (v_row->>'pantry_item_id')::uuid;
    v_qty := nullif(v_row->>'quantity','')::numeric;
    v_idem := 'meal_pantry:' || p_meal_plan_id::text || ':' || v_pantry_id::text;
    if exists (
      select 1 from public.pantry_stock_events e
      where e.pantry_item_id = v_pantry_id and e.reason = v_idem
    ) then
      continue; -- idempotent
    end if;
    if not public.can_view_pantry_item(v_pantry_id) then
      raise exception 'Pantry item not available';
    end if;
    perform public.record_pantry_stock(
      v_pantry_id,
      'used',
      case when v_qty is not null then
        (select greatest(0, coalesce(quantity,0) - v_qty) from public.pantry_items where id = v_pantry_id)
      else null end,
      null,
      null,
      v_idem,
      nullif(v_row->>'note','')
    );
  end loop;
  perform public._meal_audit(v_plan.household_id, 'meal_plan', p_meal_plan_id, 'meal.pantry_usage_confirmed');
  return p_meal_plan_id;
end $$;

create or replace function public.update_meal_batch_remaining_state(p_batch_id uuid, p_remaining_state text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_batch public.meal_prep_batches%rowtype; v_actor uuid; v_prev text;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  select * into v_batch from public.meal_prep_batches where id = p_batch_id for update;
  if not found then raise exception 'Batch not found'; end if;
  if not public.can_view_meal_batch(p_batch_id) then raise exception 'Batch not visible'; end if;
  v_actor := public._meal_active_membership(v_batch.household_id);
  v_prev := v_batch.remaining_state;
  update public.meal_prep_batches set remaining_state = p_remaining_state where id = p_batch_id;
  insert into public.meal_batch_stock_events(batch_id, household_id, event_type, previous_remaining_state, new_remaining_state, recorded_by_membership_id)
  values (p_batch_id, v_batch.household_id, 'remaining_updated', v_prev, p_remaining_state, v_actor);
  if p_remaining_state = 'low' then
    perform public._meal_notify(
      v_batch.household_id, 'meal_batch.use_soon', 'meal_prep_batch', p_batch_id, v_actor,
      (select array_agg(m.id) from public.household_memberships m where m.household_id = v_batch.household_id and m.status = 'active'),
      'Leftovers running low', v_batch.name || ' is marked low.',
      '/app/' || v_batch.household_id::text || '/meal-prep/' || p_batch_id::text
    );
  end if;
  return p_batch_id;
end $$;

create or replace function public.mark_meal_batch_finished(p_batch_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  return public.update_meal_batch_remaining_state(p_batch_id, 'finished');
end $$;

create or replace function public.discard_meal_batch(p_batch_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_batch public.meal_prep_batches%rowtype; v_actor uuid;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  select * into v_batch from public.meal_prep_batches where id = p_batch_id for update;
  if not found then raise exception 'Batch not found'; end if;
  v_actor := public._meal_active_membership(v_batch.household_id);
  update public.meal_prep_batches set remaining_state = 'finished', discarded_at = now() where id = p_batch_id;
  insert into public.meal_batch_stock_events(batch_id, household_id, event_type, previous_remaining_state, new_remaining_state, recorded_by_membership_id)
  values (p_batch_id, v_batch.household_id, 'discarded', v_batch.remaining_state, 'finished', v_actor);
  perform public._meal_audit(v_batch.household_id, 'meal_prep_batch', p_batch_id, 'meal_batch.discarded');
  return p_batch_id;
end $$;

create or replace function public.assign_meal_preparation(
  p_meal_plan_id uuid, p_cooking_membership_id uuid default null, p_cleanup_membership_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_plan public.meal_plans%rowtype; v_actor uuid;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  select * into v_plan from public.meal_plans where id = p_meal_plan_id for update;
  if not found then raise exception 'Meal plan not found'; end if;
  v_actor := public._meal_active_membership(v_plan.household_id);
  if v_plan.organizer_membership_id <> v_actor then raise exception 'Only organizer may assign'; end if;
  if p_cooking_membership_id is not null then
    if not exists (select 1 from public.household_memberships where id = p_cooking_membership_id and household_id = v_plan.household_id and status = 'active') then
      raise exception 'Cooking assignee must be active in household';
    end if;
  end if;
  if p_cleanup_membership_id is not null then
    if not exists (select 1 from public.household_memberships where id = p_cleanup_membership_id and household_id = v_plan.household_id and status = 'active') then
      raise exception 'Cleanup assignee must be active in household';
    end if;
  end if;
  update public.meal_plans set
    cooking_membership_id = coalesce(p_cooking_membership_id, cooking_membership_id),
    cleanup_membership_id = coalesce(p_cleanup_membership_id, cleanup_membership_id)
  where id = p_meal_plan_id;
  if p_cooking_membership_id is not null then
    perform public._meal_notify(
      v_plan.household_id, 'meal.cleanup_assigned', 'meal_plan', p_meal_plan_id, v_actor,
      array[p_cooking_membership_id],
      'Cooking assigned', 'You were assigned to cook a meal.',
      '/app/' || v_plan.household_id::text || '/meals/' || p_meal_plan_id::text
    );
  end if;
  if p_cleanup_membership_id is not null then
    perform public._meal_notify(
      v_plan.household_id, 'meal.cleanup_assigned', 'meal_plan', p_meal_plan_id, v_actor,
      array[p_cleanup_membership_id],
      'Cleanup assigned', 'You were assigned meal cleanup.',
      '/app/' || v_plan.household_id::text || '/meals/' || p_meal_plan_id::text
    );
  end if;
  return p_meal_plan_id;
end $$;

-- Grants
grant execute on function public.update_household_meal_settings(uuid,boolean,text) to authenticated;
grant execute on function public.create_recipe(uuid,text,text,text,numeric,int,int,text,text,text,text[],jsonb,jsonb,jsonb,uuid[]) to authenticated;
grant execute on function public.update_recipe(uuid,jsonb) to authenticated;
grant execute on function public.archive_recipe(uuid) to authenticated;
grant execute on function public.set_recipe_visibility(uuid,text,uuid[]) to authenticated;
grant execute on function public.set_recipe_favorite(uuid,boolean) to authenticated;
grant execute on function public.rate_recipe(uuid,int,boolean) to authenticated;
grant execute on function public.create_meal_plan(uuid,text,text,date,uuid,text,numeric,numeric,numeric,int,text,uuid[],boolean,timestamptz,timestamptz,text,text,uuid) to authenticated;
grant execute on function public.respond_to_meal_plan(uuid,text,int) to authenticated;
grant execute on function public.set_meal_guest_count(uuid,int,int) to authenticated;
grant execute on function public.set_meal_target_servings(uuid,numeric) to authenticated;
grant execute on function public.cancel_meal_plan(uuid) to authenticated;
grant execute on function public.create_meal_request(uuid,text,date,int,numeric,int,int,boolean,text,jsonb) to authenticated;
grant execute on function public.rank_recipe_candidates(uuid) to authenticated;
grant execute on function public.dismiss_meal_request(uuid) to authenticated;
grant execute on function public.accept_meal_request_result(uuid,uuid,date,numeric,boolean,uuid[]) to authenticated;
grant execute on function public.build_meal_shopping_proposal(uuid,uuid) to authenticated;
grant execute on function public.confirm_meal_shopping_proposal(uuid,uuid[],jsonb,uuid) to authenticated;
grant execute on function public.recalculate_meal_shopping_prep(uuid) to authenticated;
grant execute on function public.mark_meal_preparing(uuid) to authenticated;
grant execute on function public.mark_meal_prepared(uuid,boolean,numeric,text,uuid) to authenticated;
grant execute on function public.confirm_meal_pantry_usage(uuid,jsonb) to authenticated;
grant execute on function public.update_meal_batch_remaining_state(uuid,text) to authenticated;
grant execute on function public.mark_meal_batch_finished(uuid) to authenticated;
grant execute on function public.discard_meal_batch(uuid) to authenticated;
grant execute on function public.assign_meal_preparation(uuid,uuid,uuid) to authenticated;
