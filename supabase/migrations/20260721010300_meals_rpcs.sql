-- Phase 6.5: meal / recipe lifecycle RPCs

create or replace function public._meal_audit(
  p_household_id uuid, p_entity_type text, p_entity_id uuid, p_event_type text,
  p_before jsonb default null, p_after jsonb default null, p_reason text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_events(household_id, actor_user_id, entity_type, entity_id, event_type, before_state, after_state, reason, correlation_id)
  values (p_household_id, auth.uid(), p_entity_type, p_entity_id, p_event_type, p_before, p_after, p_reason, gen_random_uuid());
end $$;
revoke all on function public._meal_audit(uuid,text,uuid,text,jsonb,jsonb,text) from public, anon;

create or replace function public._meal_notify(
  p_household_id uuid, p_event_type text, p_entity_type text, p_entity_id uuid,
  p_actor_membership_id uuid, p_memberships uuid[], p_title text, p_body text, p_action_href text
) returns void language plpgsql security definer set search_path = public as $$
declare v_users uuid[];
begin
  select array_agg(distinct m.user_id) into v_users from public.household_memberships m
  where m.id = any(coalesce(p_memberships, '{}'::uuid[])) and m.status = 'active' and m.user_id <> auth.uid();
  if cardinality(coalesce(v_users, '{}'::uuid[])) > 0 then
    perform public._emit_notification_event(
      p_household_id, p_event_type, p_entity_type, p_entity_id, p_actor_membership_id, '{}'::jsonb,
      p_event_type || ':' || p_entity_id::text || ':' || extract(epoch from clock_timestamp())::bigint::text,
      v_users, p_title, p_body, p_action_href
    );
  end if;
end $$;
revoke all on function public._meal_notify(uuid,text,text,uuid,uuid,uuid[],text,text,text) from public, anon;

create or replace function public._meal_normalize_name(p_name text)
returns text language sql immutable as $$
  select trim(both ' ' from regexp_replace(lower(trim(p_name)), '[^a-z0-9\s-]+', ' ', 'g'))
$$;
revoke all on function public._meal_normalize_name(text) from public, anon;

create or replace function public._ensure_meal_settings(p_household_id uuid)
returns public.household_meal_settings language plpgsql security definer set search_path = public as $$
declare v_row public.household_meal_settings;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  insert into public.household_meal_settings(household_id)
  values (p_household_id)
  on conflict (household_id) do nothing;
  select * into v_row from public.household_meal_settings where household_id = p_household_id;
  return v_row;
end $$;
revoke all on function public._ensure_meal_settings(uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
create or replace function public.update_household_meal_settings(
  p_household_id uuid,
  p_assume_staples_available boolean default null,
  p_shopping_prep_policy text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_actor uuid; v_settings public.household_meal_settings;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  v_actor := public._meal_active_membership(p_household_id);
  if not exists (
    select 1 from public.household_membership_roles r
    where r.membership_id = v_actor and r.role = 'household_coordinator'
  ) then
    raise exception 'Only household coordinators may update meal settings';
  end if;
  v_settings := public._ensure_meal_settings(p_household_id);
  update public.household_meal_settings set
    assume_staples_available = coalesce(p_assume_staples_available, assume_staples_available),
    shopping_prep_policy = coalesce(p_shopping_prep_policy, shopping_prep_policy)
  where household_id = p_household_id;
  perform public._meal_audit(p_household_id, 'household_meal_settings', p_household_id, 'meal.settings_updated');
  return p_household_id;
end $$;

-- ---------------------------------------------------------------------------
-- Recipes
-- ---------------------------------------------------------------------------
create or replace function public.create_recipe(
  p_household_id uuid,
  p_name text,
  p_description text default null,
  p_category text default 'other',
  p_base_servings numeric default 4,
  p_prep_minutes int default null,
  p_cook_minutes int default null,
  p_difficulty text default 'unknown',
  p_visibility text default 'household',
  p_source_url text default null,
  p_tags text[] default '{}',
  p_ingredients jsonb default '[]'::jsonb,
  p_steps jsonb default '[]'::jsonb,
  p_equipment jsonb default '[]'::jsonb,
  p_visibility_membership_ids uuid[] default '{}'
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid; v_id uuid; v_ing jsonb; v_step jsonb; v_eq jsonb; v_mid uuid; v_ord int;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  v_actor := public._meal_active_membership(p_household_id);
  if p_base_servings is null or p_base_servings <= 0 then raise exception 'Base servings must be positive'; end if;
  if p_visibility = 'selected_members' and cardinality(coalesce(p_visibility_membership_ids,'{}'::uuid[])) < 1 then
    raise exception 'selected_members visibility requires at least one member';
  end if;

  insert into public.recipes(
    household_id, created_by_membership_id, name, normalized_name, description, category,
    base_servings, prep_minutes, cook_minutes, total_minutes, difficulty, visibility,
    source_type, source_url, tags
  ) values (
    p_household_id, v_actor, trim(p_name), public._meal_normalize_name(p_name),
    nullif(trim(coalesce(p_description,'')),''), p_category, p_base_servings,
    p_prep_minutes, p_cook_minutes,
    case when p_prep_minutes is null and p_cook_minutes is null then null
         else coalesce(p_prep_minutes,0) + coalesce(p_cook_minutes,0) end,
    p_difficulty, p_visibility,
    case when p_source_url is not null and length(trim(p_source_url)) > 0 then 'url_reference' else 'manual' end,
    nullif(trim(coalesce(p_source_url,'')),''), coalesce(p_tags,'{}'::text[])
  ) returning id into v_id;

  if p_visibility = 'selected_members' then
    foreach v_mid in array p_visibility_membership_ids loop
      if not exists (select 1 from public.household_memberships where id = v_mid and household_id = p_household_id and status = 'active') then
        raise exception 'Visibility member is not active in this household';
      end if;
      insert into public.recipe_visibility_members(recipe_id, household_id, membership_id)
      values (v_id, p_household_id, v_mid) on conflict do nothing;
    end loop;
  end if;

  v_ord := 0;
  for v_ing in select * from jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb))
  loop
    insert into public.recipe_ingredients(
      recipe_id, household_id, display_name, normalized_name, quantity, quantity_unit,
      quantity_mode, preparation_note, required, sort_order
    ) values (
      v_id, p_household_id,
      trim(v_ing->>'display_name'),
      public._meal_normalize_name(coalesce(v_ing->>'normalized_name', v_ing->>'display_name')),
      nullif(v_ing->>'quantity','')::numeric,
      coalesce(v_ing->>'quantity_unit','item'),
      coalesce(v_ing->>'quantity_mode','exact'),
      nullif(v_ing->>'preparation_note',''),
      coalesce((v_ing->>'required')::boolean, true),
      v_ord
    );
    v_ord := v_ord + 1;
  end loop;

  v_ord := 1;
  for v_step in select * from jsonb_array_elements(coalesce(p_steps, '[]'::jsonb))
  loop
    insert into public.recipe_steps(recipe_id, household_id, step_number, instruction, duration_minutes, phase)
    values (
      v_id, p_household_id, coalesce((v_step->>'step_number')::int, v_ord),
      trim(v_step->>'instruction'),
      nullif(v_step->>'duration_minutes','')::int,
      coalesce(v_step->>'phase','cooking')
    );
    v_ord := v_ord + 1;
  end loop;

  v_ord := 0;
  for v_eq in select * from jsonb_array_elements(coalesce(p_equipment, '[]'::jsonb))
  loop
    insert into public.recipe_equipment(recipe_id, household_id, display_name, inventory_item_id, required, sort_order)
    values (
      v_id, p_household_id, trim(v_eq->>'display_name'),
      nullif(v_eq->>'inventory_item_id','')::uuid,
      coalesce((v_eq->>'required')::boolean, true), v_ord
    );
    v_ord := v_ord + 1;
  end loop;

  perform public._meal_audit(p_household_id, 'recipe', v_id, 'recipe.created');
  if p_visibility = 'household' then
    perform public._meal_notify(
      p_household_id, 'recipe.created', 'recipe', v_id, v_actor,
      (select array_agg(m.id) from public.household_memberships m where m.household_id = p_household_id and m.status = 'active' and m.id <> v_actor),
      'Recipe added', 'A household recipe was added.',
      '/app/' || p_household_id::text || '/recipes/' || v_id::text
    );
  end if;
  return v_id;
end $$;

create or replace function public.update_recipe(p_recipe_id uuid, p_patch jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_recipe public.recipes%rowtype; v_actor uuid;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  select * into v_recipe from public.recipes where id = p_recipe_id for update;
  if not found then raise exception 'Recipe not found'; end if;
  v_actor := public._meal_active_membership(v_recipe.household_id);
  if v_recipe.created_by_membership_id <> v_actor then
    raise exception 'Only the recipe creator may edit this recipe';
  end if;
  update public.recipes set
    name = coalesce(nullif(trim(p_patch->>'name'),''), name),
    normalized_name = case when p_patch ? 'name' then public._meal_normalize_name(p_patch->>'name') else normalized_name end,
    description = case when p_patch ? 'description' then nullif(trim(p_patch->>'description'),'') else description end,
    category = coalesce(p_patch->>'category', category),
    base_servings = coalesce((p_patch->>'base_servings')::numeric, base_servings),
    prep_minutes = case when p_patch ? 'prep_minutes' then nullif(p_patch->>'prep_minutes','')::int else prep_minutes end,
    cook_minutes = case when p_patch ? 'cook_minutes' then nullif(p_patch->>'cook_minutes','')::int else cook_minutes end,
    difficulty = coalesce(p_patch->>'difficulty', difficulty),
    source_url = case when p_patch ? 'source_url' then nullif(trim(p_patch->>'source_url'),'') else source_url end
  where id = p_recipe_id;
  update public.recipes set total_minutes =
    case when prep_minutes is null and cook_minutes is null then null
         else coalesce(prep_minutes,0) + coalesce(cook_minutes,0) end
  where id = p_recipe_id;
  perform public._meal_audit(v_recipe.household_id, 'recipe', p_recipe_id, 'recipe.updated', null, p_patch);
  return p_recipe_id;
end $$;

create or replace function public.archive_recipe(p_recipe_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_recipe public.recipes%rowtype; v_actor uuid;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  select * into v_recipe from public.recipes where id = p_recipe_id for update;
  if not found then raise exception 'Recipe not found'; end if;
  v_actor := public._meal_active_membership(v_recipe.household_id);
  if v_recipe.created_by_membership_id <> v_actor
     and not (
       v_recipe.visibility = 'household'
       and exists (
         select 1 from public.household_membership_roles r
         where r.membership_id = v_actor and r.role = 'household_coordinator'
       )
     ) then
    raise exception 'Not allowed to archive this recipe';
  end if;
  if v_recipe.visibility = 'creator_only' and v_recipe.created_by_membership_id <> v_actor then
    raise exception 'Coordinators cannot archive creator-only recipes';
  end if;
  update public.recipes set archived_at = now() where id = p_recipe_id;
  perform public._meal_audit(v_recipe.household_id, 'recipe', p_recipe_id, 'recipe.archived');
  return p_recipe_id;
end $$;

create or replace function public.set_recipe_visibility(
  p_recipe_id uuid, p_visibility text, p_membership_ids uuid[] default '{}'
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_recipe public.recipes%rowtype; v_actor uuid; v_mid uuid;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  select * into v_recipe from public.recipes where id = p_recipe_id for update;
  if not found then raise exception 'Recipe not found'; end if;
  v_actor := public._meal_active_membership(v_recipe.household_id);
  if v_recipe.created_by_membership_id <> v_actor then
    raise exception 'Only the recipe creator may change visibility';
  end if;
  update public.recipes set visibility = p_visibility where id = p_recipe_id;
  delete from public.recipe_visibility_members where recipe_id = p_recipe_id;
  if p_visibility = 'selected_members' then
    foreach v_mid in array coalesce(p_membership_ids, '{}'::uuid[]) loop
      insert into public.recipe_visibility_members(recipe_id, household_id, membership_id)
      values (p_recipe_id, v_recipe.household_id, v_mid);
    end loop;
  end if;
  perform public._meal_audit(v_recipe.household_id, 'recipe', p_recipe_id, 'recipe.visibility_changed');
  return p_recipe_id;
end $$;

create or replace function public.set_recipe_favorite(p_recipe_id uuid, p_is_favorite boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_recipe public.recipes%rowtype; v_actor uuid;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  select * into v_recipe from public.recipes where id = p_recipe_id;
  if not found then raise exception 'Recipe not found'; end if;
  if not public.can_view_recipe(p_recipe_id) then raise exception 'Recipe not visible'; end if;
  v_actor := public._meal_active_membership(v_recipe.household_id);
  insert into public.recipe_user_preferences(household_id, recipe_id, membership_id, is_favorite)
  values (v_recipe.household_id, p_recipe_id, v_actor, p_is_favorite)
  on conflict (recipe_id, membership_id) do update set is_favorite = excluded.is_favorite;
  return p_recipe_id;
end $$;

create or replace function public.rate_recipe(p_recipe_id uuid, p_personal_rating int default null, p_would_make_again boolean default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_recipe public.recipes%rowtype; v_actor uuid;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  select * into v_recipe from public.recipes where id = p_recipe_id;
  if not found then raise exception 'Recipe not found'; end if;
  if not public.can_view_recipe(p_recipe_id) then raise exception 'Recipe not visible'; end if;
  v_actor := public._meal_active_membership(v_recipe.household_id);
  insert into public.recipe_user_preferences(household_id, recipe_id, membership_id, personal_rating, would_make_again)
  values (v_recipe.household_id, p_recipe_id, v_actor, p_personal_rating, p_would_make_again)
  on conflict (recipe_id, membership_id) do update set
    personal_rating = coalesce(excluded.personal_rating, recipe_user_preferences.personal_rating),
    would_make_again = coalesce(excluded.would_make_again, recipe_user_preferences.would_make_again);
  return p_recipe_id;
end $$;

-- ---------------------------------------------------------------------------
-- Meal plans
-- ---------------------------------------------------------------------------
create or replace function public.create_meal_plan(
  p_household_id uuid,
  p_meal_type text,
  p_title text,
  p_meal_date date,
  p_recipe_id uuid default null,
  p_custom_meal_name text default null,
  p_target_servings numeric default 4,
  p_buffer_servings numeric default 0,
  p_desired_leftover_servings numeric default 0,
  p_guest_count int default 0,
  p_visibility text default null,
  p_attendee_membership_ids uuid[] default '{}',
  p_link_calendar boolean default false,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_notes text default null,
  p_guest_cost_policy text default 'manual',
  p_meal_request_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid; v_id uuid; v_vis text; v_mid uuid; v_cal uuid; v_cat text;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  perform set_config('householdos.calendar_mutation', 'rpc', true);
  v_actor := public._meal_active_membership(p_household_id);
  if p_guest_count < 0 or p_guest_count > 20 then raise exception 'Guest count out of bounds'; end if;
  if p_recipe_id is not null and not public.can_view_recipe(p_recipe_id) then
    raise exception 'Recipe not visible';
  end if;
  if p_recipe_id is not null and not exists (
    select 1 from public.recipes where id = p_recipe_id and household_id = p_household_id
  ) then raise exception 'Recipe must belong to this household'; end if;

  v_vis := coalesce(p_visibility, case when p_meal_type = 'personal' then 'creator_only' else 'household' end);

  insert into public.meal_plans(
    household_id, created_by_membership_id, organizer_membership_id, meal_type, title,
    recipe_id, custom_meal_name, meal_date, starts_at, ends_at, visibility, status,
    target_servings, buffer_servings, desired_leftover_servings, guest_count,
    guest_cost_policy, notes, meal_request_id
  ) values (
    p_household_id, v_actor, v_actor, p_meal_type, trim(p_title),
    p_recipe_id, nullif(trim(coalesce(p_custom_meal_name,'')),''), p_meal_date, p_starts_at, p_ends_at,
    v_vis, 'planned', p_target_servings, coalesce(p_buffer_servings,0), coalesce(p_desired_leftover_servings,0),
    coalesce(p_guest_count,0), coalesce(p_guest_cost_policy,'manual'),
    nullif(trim(coalesce(p_notes,'')),''), p_meal_request_id
  ) returning id into v_id;

  foreach v_mid in array coalesce(p_attendee_membership_ids, '{}'::uuid[]) loop
    if not exists (select 1 from public.household_memberships where id = v_mid and household_id = p_household_id and status = 'active') then
      raise exception 'Cross-household or inactive participant rejected';
    end if;
    insert into public.meal_attendees(meal_plan_id, household_id, membership_id, attendance_status)
    values (v_id, p_household_id, v_mid, 'no_response')
    on conflict do nothing;
  end loop;

  -- Snapshot recipe ingredients onto meal plan
  if p_recipe_id is not null then
    insert into public.meal_plan_ingredients(
      meal_plan_id, household_id, recipe_ingredient_id, display_name, normalized_name,
      required_quantity, scaled_quantity, quantity_unit, quantity_mode, required, sort_order
    )
    select v_id, p_household_id, ri.id, ri.display_name, ri.normalized_name,
      ri.quantity,
      case
        when ri.quantity_mode in ('to_taste','as_needed') or ri.quantity is null then ri.quantity
        else round(ri.quantity * (p_target_servings / nullif((select base_servings from public.recipes where id = p_recipe_id),0)), 3)
      end,
      ri.quantity_unit, ri.quantity_mode, ri.required, ri.sort_order
    from public.recipe_ingredients ri where ri.recipe_id = p_recipe_id;
  end if;

  if p_link_calendar and p_meal_type <> 'personal' then
    v_cat := case when p_meal_type = 'meal_prep' then 'meal_prep' else 'shared_meal' end;
    v_cal := public.create_calendar_event(
      p_household_id,
      trim(p_title),
      null, -- description
      null, -- location
      v_cat,
      'household',
      p_starts_at is null, -- all_day when no start time
      p_starts_at,
      p_ends_at,
      case when p_starts_at is null then p_meal_date else null end,
      case when p_starts_at is null then p_meal_date + 1 else null end,
      'America/Chicago',
      null, null, null,
      coalesce(p_guest_count, 0),
      null,
      coalesce(p_attendee_membership_ids, '{}'::uuid[]),
      '{60}',
      'meal_plan:' || v_id::text
    );
    update public.calendar_events set source_type = 'meal_plan', source_id = v_id where id = v_cal;
    update public.meal_plans set calendar_event_id = v_cal where id = v_id;
  end if;

  if p_meal_type <> 'personal' then
    perform public._meal_notify(
      p_household_id, 'meal.planned', 'meal_plan', v_id, v_actor,
      coalesce(p_attendee_membership_ids, '{}'::uuid[]),
      'Meal planned', 'A shared meal was planned.',
      '/app/' || p_household_id::text || '/meals/' || v_id::text
    );
  end if;
  perform public._meal_audit(p_household_id, 'meal_plan', v_id, 'meal.planned');
  return v_id;
end $$;

create or replace function public.respond_to_meal_plan(p_meal_plan_id uuid, p_status text, p_guest_count int default 0)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_plan public.meal_plans%rowtype; v_actor uuid;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  select * into v_plan from public.meal_plans where id = p_meal_plan_id for update;
  if not found then raise exception 'Meal plan not found'; end if;
  if not public.can_view_meal_plan(p_meal_plan_id) then raise exception 'Meal plan not visible'; end if;
  v_actor := public._meal_active_membership(v_plan.household_id);
  if p_guest_count < 0 or p_guest_count > 20 then raise exception 'Guest count out of bounds'; end if;
  if p_status not in ('going','maybe','not_going','no_response') then raise exception 'Invalid attendance status'; end if;
  insert into public.meal_attendees(meal_plan_id, household_id, membership_id, attendance_status, guest_count)
  values (p_meal_plan_id, v_plan.household_id, v_actor, p_status, coalesce(p_guest_count,0))
  on conflict (meal_plan_id, membership_id) do update set
    attendance_status = excluded.attendance_status,
    guest_count = excluded.guest_count,
    updated_at = now();
  -- Sync calendar RSVP when linked
  if v_plan.calendar_event_id is not null then
    begin
      perform public.respond_to_calendar_event(
        v_plan.calendar_event_id,
        case p_status when 'going' then 'going' when 'maybe' then 'maybe' when 'not_going' then 'not_going' else 'needs_action' end,
        coalesce(p_guest_count,0)
      );
    exception when undefined_function then null;
    end;
  end if;
  perform public._meal_audit(v_plan.household_id, 'meal_plan', p_meal_plan_id, 'meal.rsvp_changed');
  return p_meal_plan_id;
end $$;

create or replace function public.set_meal_guest_count(p_meal_plan_id uuid, p_guest_count int, p_possible_guest_count int default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_plan public.meal_plans%rowtype; v_actor uuid;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  select * into v_plan from public.meal_plans where id = p_meal_plan_id for update;
  if not found then raise exception 'Meal plan not found'; end if;
  v_actor := public._meal_active_membership(v_plan.household_id);
  if v_plan.organizer_membership_id <> v_actor then raise exception 'Only the organizer may set guest count'; end if;
  if p_guest_count < 0 or p_guest_count > 20 then raise exception 'Guest count out of bounds'; end if;
  update public.meal_plans set
    guest_count = p_guest_count,
    possible_guest_count = coalesce(p_possible_guest_count, possible_guest_count)
  where id = p_meal_plan_id;
  return p_meal_plan_id;
end $$;

create or replace function public.set_meal_target_servings(p_meal_plan_id uuid, p_target_servings numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_plan public.meal_plans%rowtype; v_actor uuid; v_base numeric;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  select * into v_plan from public.meal_plans where id = p_meal_plan_id for update;
  if not found then raise exception 'Meal plan not found'; end if;
  v_actor := public._meal_active_membership(v_plan.household_id);
  if v_plan.organizer_membership_id <> v_actor then raise exception 'Only the organizer may set target servings'; end if;
  if p_target_servings is null or p_target_servings <= 0 then raise exception 'Target servings must be positive'; end if;
  update public.meal_plans set target_servings = p_target_servings where id = p_meal_plan_id;
  if v_plan.recipe_id is not null then
    select base_servings into v_base from public.recipes where id = v_plan.recipe_id;
    update public.meal_plan_ingredients mpi set
      scaled_quantity = case
        when mpi.quantity_mode in ('to_taste','as_needed') or mpi.required_quantity is null then mpi.required_quantity
        else round(mpi.required_quantity * (p_target_servings / nullif(v_base,0)), 3)
      end
    where mpi.meal_plan_id = p_meal_plan_id;
  end if;
  perform public.recalculate_meal_shopping_prep(p_meal_plan_id);
  return p_meal_plan_id;
end $$;

create or replace function public.cancel_meal_plan(p_meal_plan_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_plan public.meal_plans%rowtype; v_actor uuid;
begin
  perform set_config('householdos.meal_mutation', 'rpc', true);
  perform set_config('householdos.resource_mutation', 'rpc', true);
  select * into v_plan from public.meal_plans where id = p_meal_plan_id for update;
  if not found then raise exception 'Meal plan not found'; end if;
  v_actor := public._meal_active_membership(v_plan.household_id);
  if v_plan.organizer_membership_id <> v_actor and v_plan.created_by_membership_id <> v_actor then
    raise exception 'Only the organizer may cancel this meal';
  end if;
  update public.meal_plans set status = 'cancelled', cancelled_at = now() where id = p_meal_plan_id;
  update public.meal_shopping_proposals set status = 'cancelled' where meal_plan_id = p_meal_plan_id and status = 'draft';
  -- Cancel active (non-purchased) linked shopping items
  update public.shopping_list_items set status = 'cancelled', cancelled_at = now()
  where related_meal_plan_id = p_meal_plan_id
    and status in ('requested','approved','assigned','in_cart');
  -- Cancel future reminders
  update public.scheduled_notification_requests set cancelled_at = now()
  where source_type = 'meal_plan' and source_id = p_meal_plan_id
    and processed_at is null and cancelled_at is null;
  if v_plan.calendar_event_id is not null then
    begin
      perform public.cancel_calendar_event(v_plan.calendar_event_id);
    exception when undefined_function then
      update public.calendar_events set status = 'cancelled' where id = v_plan.calendar_event_id;
    end;
  end if;
  perform public._meal_audit(v_plan.household_id, 'meal_plan', p_meal_plan_id, 'meal.cancelled');
  if v_plan.meal_type <> 'personal' then
    perform public._meal_notify(
      v_plan.household_id, 'meal.cancelled', 'meal_plan', p_meal_plan_id, v_actor,
      (select array_agg(a.membership_id) from public.meal_attendees a where a.meal_plan_id = p_meal_plan_id),
      'Meal cancelled', 'A planned meal was cancelled.',
      '/app/' || v_plan.household_id::text || '/meals'
    );
  end if;
  return p_meal_plan_id;
end $$;

