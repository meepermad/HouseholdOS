-- Shopping Intelligence mutation RPCs

create or replace function public._shopping_intel_actor(p_household_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_active_member(p_household_id) then
    raise exception 'Not an active household member';
  end if;
  v_actor := public.current_membership_id(p_household_id);
  return v_actor;
end;
$$;

revoke all on function public._shopping_intel_actor(uuid) from public;

create or replace function public.ensure_shopping_recommendation_preferences(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._shopping_intel_actor(p_household_id);
  insert into public.shopping_recommendation_preferences (household_id)
  values (p_household_id)
  on conflict (household_id) do nothing;
  insert into public.recipe_rediscovery_preferences (household_id)
  values (p_household_id)
  on conflict (household_id) do nothing;
end;
$$;

revoke all on function public.ensure_shopping_recommendation_preferences(uuid) from public;
grant execute on function public.ensure_shopping_recommendation_preferences(uuid) to authenticated;

create or replace function public.update_shopping_recommendation_preferences(
  p_household_id uuid,
  p_enabled boolean default null,
  p_include_supply_forecasts boolean default null,
  p_include_recurring_staples boolean default null,
  p_include_proposed_meal_ingredients boolean default null,
  p_include_guest_needs boolean default null,
  p_forecast_confidence_threshold text default null,
  p_recommendation_horizon_days integer default null,
  p_show_personal_separately boolean default null,
  p_rediscovery_enabled boolean default null,
  p_rediscovery_cadence text default null,
  p_min_days_since_prepared integer default null,
  p_max_suggestions_per_trip integer default null,
  p_allow_push_reminders boolean default null,
  p_include_guest_friendly boolean default null,
  p_include_meal_prep_favorites boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
begin
  v_actor := public._shopping_intel_actor(p_household_id);
  if not public.is_household_coordinator(p_household_id) then
    raise exception 'Only a household coordinator can update shopping recommendation settings';
  end if;
  perform public.ensure_shopping_recommendation_preferences(p_household_id);

  update public.shopping_recommendation_preferences set
    enabled = coalesce(p_enabled, enabled),
    include_supply_forecasts = coalesce(p_include_supply_forecasts, include_supply_forecasts),
    include_recurring_staples = coalesce(p_include_recurring_staples, include_recurring_staples),
    include_proposed_meal_ingredients = coalesce(p_include_proposed_meal_ingredients, include_proposed_meal_ingredients),
    include_guest_needs = coalesce(p_include_guest_needs, include_guest_needs),
    forecast_confidence_threshold = coalesce(p_forecast_confidence_threshold, forecast_confidence_threshold),
    recommendation_horizon_days = coalesce(p_recommendation_horizon_days, recommendation_horizon_days),
    show_personal_separately = coalesce(p_show_personal_separately, show_personal_separately),
    updated_at = now(),
    updated_by_membership_id = v_actor
  where household_id = p_household_id;

  update public.recipe_rediscovery_preferences set
    enabled = coalesce(p_rediscovery_enabled, enabled),
    cadence = coalesce(p_rediscovery_cadence, cadence),
    min_days_since_prepared = coalesce(p_min_days_since_prepared, min_days_since_prepared),
    max_suggestions_per_trip = coalesce(p_max_suggestions_per_trip, max_suggestions_per_trip),
    allow_push_reminders = coalesce(p_allow_push_reminders, allow_push_reminders),
    include_guest_friendly = coalesce(p_include_guest_friendly, include_guest_friendly),
    include_meal_prep_favorites = coalesce(p_include_meal_prep_favorites, include_meal_prep_favorites),
    updated_at = now(),
    updated_by_membership_id = v_actor
  where household_id = p_household_id;

  insert into public.audit_events (
    household_id, actor_user_id, entity_type, entity_id, event_type, after_state
  ) values (
    p_household_id, auth.uid(), 'shopping_recommendation_preferences', p_household_id,
    'shopping.recommendation_settings_updated',
    jsonb_build_object('enabled', coalesce(p_enabled, true))
  );
end;
$$;

revoke all on function public.update_shopping_recommendation_preferences(
  uuid, boolean, boolean, boolean, boolean, boolean, text, integer, boolean,
  boolean, text, integer, integer, boolean, boolean, boolean
) from public;
grant execute on function public.update_shopping_recommendation_preferences(
  uuid, boolean, boolean, boolean, boolean, boolean, text, integer, boolean,
  boolean, text, integer, integer, boolean, boolean, boolean
) to authenticated;

create or replace function public.persist_shopping_recommendation_run(
  p_household_id uuid,
  p_list_id uuid,
  p_mode_filter text,
  p_scope text,
  p_items jsonb,
  p_source_freshness jsonb default '{}'::jsonb,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_run_id uuid;
  v_item jsonb;
  v_item_id uuid;
  v_src jsonb;
begin
  v_actor := public._shopping_intel_actor(p_household_id);
  if p_idempotency_key is not null then
    select id into v_run_id from public.shopping_recommendation_runs
    where household_id = p_household_id and client_idempotency_key = p_idempotency_key;
    if found then return v_run_id; end if;
  end if;

  insert into public.shopping_recommendation_runs (
    household_id, list_id, scope, viewer_membership_id, mode_filter,
    status, source_freshness, client_idempotency_key, expires_at
  ) values (
    p_household_id, p_list_id, coalesce(p_scope, 'shared'), v_actor,
    coalesce(p_mode_filter, 'everything'), 'ready', coalesce(p_source_freshness, '{}'::jsonb),
    p_idempotency_key, now() + interval '7 days'
  ) returning id into v_run_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    insert into public.shopping_recommendation_items (
      run_id, household_id, list_id, name, normalized_key, priority_band,
      suggested_quantity, suggested_unit, quantity_breakdown, unit_mismatch,
      visibility, owner_membership_id, related_supply_id, related_pantry_id,
      explanation, reason_codes, confidence, status, existing_list_item_id, sort_order
    ) values (
      v_run_id, p_household_id, p_list_id,
      v_item->>'name',
      v_item->>'normalizedKey',
      v_item->>'priorityBand',
      nullif(v_item->>'suggestedQuantity', '')::numeric,
      coalesce(v_item->>'suggestedUnit', 'item'),
      coalesce(v_item->'quantityBreakdown', '[]'::jsonb),
      coalesce((v_item->>'unitMismatch')::boolean, false),
      coalesce(v_item->>'visibility', 'shared'),
      nullif(v_item->>'ownerMembershipId', '')::uuid,
      nullif(v_item->>'relatedSupplyId', '')::uuid,
      nullif(v_item->>'relatedPantryId', '')::uuid,
      v_item->>'explanation',
      coalesce(
        (select array_agg(x) from jsonb_array_elements_text(coalesce(v_item->'reasonCodes', '[]'::jsonb)) as t(x)),
        '{}'::text[]
      ),
      coalesce(v_item->>'confidence', 'medium'),
      'suggested',
      nullif(v_item->>'existingListItemId', '')::uuid,
      coalesce((v_item->>'sortOrder')::integer, 0)
    ) returning id into v_item_id;

    for v_src in select * from jsonb_array_elements(coalesce(v_item->'sources', '[]'::jsonb))
    loop
      insert into public.shopping_recommendation_sources (
        item_id, household_id, source_type, source_id, reason_code, explanation,
        quantity, quantity_unit
      ) values (
        v_item_id, p_household_id,
        v_src->>'sourceType',
        nullif(v_src->>'sourceId', '')::uuid,
        v_src->>'reasonCode',
        v_src->>'explanation',
        nullif(v_src->>'quantity', '')::numeric,
        v_src->>'quantityUnit'
      );
    end loop;
  end loop;

  return v_run_id;
end;
$$;

revoke all on function public.persist_shopping_recommendation_run(
  uuid, uuid, text, text, jsonb, jsonb, text
) from public;
grant execute on function public.persist_shopping_recommendation_run(
  uuid, uuid, text, text, jsonb, jsonb, text
) to authenticated;

create or replace function public.add_recommended_item_to_list(
  p_item_id uuid,
  p_quantity numeric default null,
  p_quantity_unit text default null,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.shopping_recommendation_items%rowtype;
  v_actor uuid;
  v_shopping_id uuid;
  v_decision_id uuid;
begin
  select * into v_item from public.shopping_recommendation_items where id = p_item_id for update;
  if not found then raise exception 'Recommendation not found'; end if;
  v_actor := public._shopping_intel_actor(v_item.household_id);

  if p_idempotency_key is not null then
    select resulting_shopping_item_id into v_shopping_id
    from public.shopping_recommendation_decisions
    where household_id = v_item.household_id and client_idempotency_key = p_idempotency_key;
    if v_shopping_id is not null then return v_shopping_id; end if;
  end if;

  if v_item.status = 'added' and v_item.existing_list_item_id is not null then
    return v_item.existing_list_item_id;
  end if;

  v_shopping_id := public.create_shopping_item(
    v_item.household_id,
    v_item.name,
    v_item.list_id,
    'other',
    coalesce(p_quantity, v_item.suggested_quantity),
    coalesce(p_quantity_unit, v_item.suggested_unit, 'item'),
    case when v_item.priority_band = 'urgent' then 'high' else 'normal' end,
    case when v_item.visibility = 'personal' then 'personal' else 'household' end,
    v_item.owner_membership_id,
    null,
    null,
    v_item.related_supply_id,
    v_item.related_pantry_id,
    null,
    left(v_item.explanation, 500)
  );

  update public.shopping_recommendation_items
  set status = 'added', existing_list_item_id = v_shopping_id, updated_at = now()
  where id = v_item.id;

  insert into public.shopping_recommendation_decisions (
    household_id, item_id, actor_membership_id, decision,
    resulting_shopping_item_id, client_idempotency_key
  ) values (
    v_item.household_id, v_item.id, v_actor, 'added', v_shopping_id, p_idempotency_key
  ) returning id into v_decision_id;

  insert into public.audit_events (
    household_id, actor_user_id, entity_type, entity_id, event_type, after_state
  ) values (
    v_item.household_id, auth.uid(), 'shopping_recommendation_item', v_item.id,
    'shopping.recommendation_added',
    jsonb_build_object('shopping_item_id', v_shopping_id)
  );

  return v_shopping_id;
end;
$$;

revoke all on function public.add_recommended_item_to_list(uuid, numeric, text, text) from public;
grant execute on function public.add_recommended_item_to_list(uuid, numeric, text, text) to authenticated;

create or replace function public.dismiss_shopping_recommendation(
  p_item_id uuid,
  p_decision text default 'dismissed',
  p_snooze_until timestamptz default null,
  p_idempotency_key text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.shopping_recommendation_items%rowtype;
  v_actor uuid;
  v_status text;
begin
  select * into v_item from public.shopping_recommendation_items where id = p_item_id for update;
  if not found then raise exception 'Recommendation not found'; end if;
  v_actor := public._shopping_intel_actor(v_item.household_id);

  if p_idempotency_key is not null and exists (
    select 1 from public.shopping_recommendation_decisions
    where household_id = v_item.household_id and client_idempotency_key = p_idempotency_key
  ) then
    return;
  end if;

  v_status := case p_decision
    when 'snoozed' then 'snoozed'
    when 'suppress_auto' then 'suppressed'
    when 'no_longer_use' then 'suppressed'
    else 'dismissed'
  end;

  update public.shopping_recommendation_items
  set status = v_status, updated_at = now()
  where id = v_item.id;

  insert into public.shopping_recommendation_decisions (
    household_id, item_id, actor_membership_id, decision, snooze_until, client_idempotency_key
  ) values (
    v_item.household_id, v_item.id, v_actor, p_decision, p_snooze_until, p_idempotency_key
  );
end;
$$;

revoke all on function public.dismiss_shopping_recommendation(uuid, text, timestamptz, text) from public;
grant execute on function public.dismiss_shopping_recommendation(uuid, text, timestamptz, text) to authenticated;

create or replace function public.start_shopping_trip(
  p_household_id uuid,
  p_list_id uuid,
  p_store_label text default null,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_id uuid;
begin
  v_actor := public._shopping_intel_actor(p_household_id);
  if p_idempotency_key is not null then
    select id into v_id from public.shopping_trip_sessions
    where household_id = p_household_id and client_idempotency_key = p_idempotency_key;
    if found then return v_id; end if;
  end if;
  if not exists (
    select 1 from public.shopping_lists where id = p_list_id and household_id = p_household_id
  ) then
    raise exception 'Shopping list not found';
  end if;
  insert into public.shopping_trip_sessions (
    household_id, list_id, started_by_membership_id, store_label, client_idempotency_key
  ) values (
    p_household_id, p_list_id, v_actor, nullif(trim(coalesce(p_store_label, '')), ''), p_idempotency_key
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.start_shopping_trip(uuid, uuid, text, text) from public;
grant execute on function public.start_shopping_trip(uuid, uuid, text, text) to authenticated;

create or replace function public.complete_shopping_trip(p_trip_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip public.shopping_trip_sessions%rowtype;
  v_open record;
begin
  select * into v_trip from public.shopping_trip_sessions where id = p_trip_id for update;
  if not found then raise exception 'Trip not found'; end if;
  perform public._shopping_intel_actor(v_trip.household_id);

  for v_open in
    select i.id from public.shopping_list_items i
    where i.list_id = v_trip.list_id
      and i.status in ('requested', 'approved', 'assigned', 'in_cart')
  loop
    insert into public.shopping_trip_events (
      trip_id, household_id, shopping_item_id, event_type, actor_membership_id
    ) values (
      v_trip.id, v_trip.household_id, v_open.id, 'still_needed',
      public.current_membership_id(v_trip.household_id)
    );
  end loop;

  update public.shopping_trip_sessions
  set status = 'completed', completed_at = now()
  where id = v_trip.id;
end;
$$;

revoke all on function public.complete_shopping_trip(uuid) from public;
grant execute on function public.complete_shopping_trip(uuid) to authenticated;

create or replace function public.record_shopping_trip_event(
  p_trip_id uuid,
  p_shopping_item_id uuid,
  p_event_type text,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip public.shopping_trip_sessions%rowtype;
  v_id uuid;
begin
  select * into v_trip from public.shopping_trip_sessions where id = p_trip_id;
  if not found then raise exception 'Trip not found'; end if;
  perform public._shopping_intel_actor(v_trip.household_id);
  insert into public.shopping_trip_events (
    trip_id, household_id, shopping_item_id, event_type, payload, actor_membership_id
  ) values (
    p_trip_id, v_trip.household_id, p_shopping_item_id, p_event_type,
    coalesce(p_payload, '{}'::jsonb), public.current_membership_id(v_trip.household_id)
  ) returning id into v_id;

  if p_event_type = 'unavailable' and p_shopping_item_id is not null then
    perform public.mark_shopping_item_unavailable(p_shopping_item_id);
  end if;
  return v_id;
end;
$$;

revoke all on function public.record_shopping_trip_event(uuid, uuid, text, jsonb) from public;
grant execute on function public.record_shopping_trip_event(uuid, uuid, text, jsonb) to authenticated;

create or replace function public.persist_recipe_rediscovery_suggestions(
  p_household_id uuid,
  p_list_id uuid,
  p_trip_id uuid,
  p_suggestions jsonb,
  p_idempotency_key text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_row jsonb;
  v_count integer := 0;
  v_key text;
begin
  v_actor := public._shopping_intel_actor(p_household_id);
  for v_row in select * from jsonb_array_elements(coalesce(p_suggestions, '[]'::jsonb))
  loop
    v_key := case
      when p_idempotency_key is null then null
      else p_idempotency_key || ':' || (v_row->>'recipeId')
    end;
    if v_key is not null and exists (
      select 1 from public.recipe_rediscovery_suggestions
      where household_id = p_household_id and client_idempotency_key = v_key
    ) then
      continue;
    end if;
    insert into public.recipe_rediscovery_suggestions (
      household_id, recipe_id, list_id, trip_id, viewer_membership_id,
      score, explanation, reason_codes, pantry_have, pantry_total,
      missing_summary, preference_fit, expires_at, client_idempotency_key
    ) values (
      p_household_id,
      (v_row->>'recipeId')::uuid,
      p_list_id,
      p_trip_id,
      v_actor,
      coalesce((v_row->>'score')::numeric, 0),
      v_row->>'explanation',
      coalesce(
        (select array_agg(x) from jsonb_array_elements_text(coalesce(v_row->'reasonCodes', '[]'::jsonb)) as t(x)),
        '{}'::text[]
      ),
      coalesce((v_row->>'pantryHave')::integer, 0),
      coalesce((v_row->>'pantryTotal')::integer, 0),
      coalesce(v_row->'missingSummary', '[]'::jsonb),
      coalesce(v_row->>'preferenceFit', 'unknown'),
      now() + interval '14 days',
      v_key
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.persist_recipe_rediscovery_suggestions(
  uuid, uuid, uuid, jsonb, text
) from public;
grant execute on function public.persist_recipe_rediscovery_suggestions(
  uuid, uuid, uuid, jsonb, text
) to authenticated;

create or replace function public.decide_recipe_rediscovery(
  p_suggestion_id uuid,
  p_decision text,
  p_idempotency_key text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sug public.recipe_rediscovery_suggestions%rowtype;
  v_actor uuid;
  v_status text;
  v_snooze timestamptz;
begin
  select * into v_sug from public.recipe_rediscovery_suggestions where id = p_suggestion_id for update;
  if not found then raise exception 'Suggestion not found'; end if;
  v_actor := public._shopping_intel_actor(v_sug.household_id);

  if p_idempotency_key is not null and exists (
    select 1 from public.recipe_rediscovery_decisions
    where household_id = v_sug.household_id and client_idempotency_key = p_idempotency_key
  ) then
    return;
  end if;

  v_status := case p_decision
    when 'plan' then 'planned'
    when 'add_ingredients' then 'ingredients_added'
    when 'save_for_later' then 'saved'
    when 'not_this_time' then 'dismissed'
    when 'remind_next_month' then 'snoozed'
    when 'recently_had' then 'dismissed'
    when 'suppress' then 'suppressed'
    else 'dismissed'
  end;
  v_snooze := case when p_decision = 'remind_next_month' then now() + interval '30 days' else null end;

  update public.recipe_rediscovery_suggestions
  set status = v_status
  where id = v_sug.id;

  insert into public.recipe_rediscovery_decisions (
    household_id, suggestion_id, recipe_id, actor_membership_id, decision, client_idempotency_key
  ) values (
    v_sug.household_id, v_sug.id, v_sug.recipe_id, v_actor, p_decision, p_idempotency_key
  );

  if p_decision in ('remind_next_month', 'not_this_time', 'recently_had', 'suppress') then
    insert into public.recipe_suggestion_snoozes (
      household_id, recipe_id, membership_id, scope, reason, snooze_until
    ) values (
      v_sug.household_id, v_sug.recipe_id, v_actor, 'household',
      case p_decision
        when 'suppress' then 'suppress'
        when 'recently_had' then 'recently_had'
        when 'not_this_time' then 'not_this_time'
        else 'snooze'
      end,
      v_snooze
    )
    on conflict (household_id, recipe_id, membership_id, reason) do update
      set snooze_until = excluded.snooze_until, created_at = now();
  end if;

  if p_decision = 'recently_had' then
    insert into public.recipe_prep_history (
      household_id, recipe_id, times_prepared, last_prepared_at
    ) values (
      v_sug.household_id, v_sug.recipe_id, 1, now()
    )
    on conflict (recipe_id, household_id) do update
      set last_prepared_at = now(),
          times_prepared = public.recipe_prep_history.times_prepared + 1;
  end if;
end;
$$;

revoke all on function public.decide_recipe_rediscovery(uuid, text, text) from public;
grant execute on function public.decide_recipe_rediscovery(uuid, text, text) to authenticated;
