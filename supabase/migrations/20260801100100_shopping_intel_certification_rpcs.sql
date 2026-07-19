-- Shopping Intelligence certification RPCs

create or replace function public.suppress_shopping_staple(
  p_household_id uuid,
  p_normalized_key text,
  p_related_supply_id uuid default null,
  p_reason text default 'do_not_recommend'
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
  insert into public.shopping_staple_suppressions (
    household_id, normalized_key, related_supply_id, suppressed_by_membership_id, reason
  ) values (
    p_household_id, lower(trim(p_normalized_key)), p_related_supply_id, v_actor, coalesce(p_reason, 'do_not_recommend')
  )
  on conflict (household_id, normalized_key) do update
    set reason = excluded.reason,
        related_supply_id = coalesce(excluded.related_supply_id, public.shopping_staple_suppressions.related_supply_id),
        suppressed_by_membership_id = excluded.suppressed_by_membership_id
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.suppress_shopping_staple(uuid, text, uuid, text) from public;
grant execute on function public.suppress_shopping_staple(uuid, text, uuid, text) to authenticated;

create or replace function public.persist_rediscovery_ingredient_proposal(
  p_suggestion_id uuid,
  p_list_id uuid,
  p_lines jsonb,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sug public.recipe_rediscovery_suggestions%rowtype;
  v_actor uuid;
  v_proposal_id uuid;
  v_line jsonb;
  v_i integer := 0;
begin
  select * into v_sug from public.recipe_rediscovery_suggestions where id = p_suggestion_id for update;
  if not found then raise exception 'Suggestion not found'; end if;
  v_actor := public._shopping_intel_actor(v_sug.household_id);

  if p_idempotency_key is not null then
    select id into v_proposal_id
    from public.recipe_rediscovery_ingredient_proposals
    where household_id = v_sug.household_id and client_idempotency_key = p_idempotency_key;
    if v_proposal_id is not null then
      return v_proposal_id;
    end if;
  end if;

  -- Expire prior drafts for this suggestion
  update public.recipe_rediscovery_ingredient_proposals
  set status = 'expired'
  where suggestion_id = p_suggestion_id and status = 'draft';

  insert into public.recipe_rediscovery_ingredient_proposals (
    household_id, suggestion_id, recipe_id, list_id, built_by_membership_id,
    client_idempotency_key, policy_note
  ) values (
    v_sug.household_id, v_sug.id, v_sug.recipe_id, p_list_id, v_actor,
    p_idempotency_key, 'review_first'
  )
  returning id into v_proposal_id;

  for v_line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb))
  loop
    insert into public.recipe_rediscovery_ingredient_proposal_lines (
      proposal_id, household_id, recipe_ingredient_id, display_name, required,
      required_quantity, shortfall_quantity, quantity_unit, line_status,
      unit_mismatch, excluded, already_on_list, existing_list_item_id, sort_order
    ) values (
      v_proposal_id,
      v_sug.household_id,
      nullif(v_line->>'recipeIngredientId', '')::uuid,
      coalesce(nullif(trim(v_line->>'displayName'), ''), 'Ingredient'),
      coalesce((v_line->>'required')::boolean, true),
      nullif(v_line->>'requiredQuantity', '')::numeric,
      nullif(v_line->>'shortfallQuantity', '')::numeric,
      coalesce(nullif(v_line->>'quantityUnit', ''), 'item'),
      coalesce(nullif(v_line->>'lineStatus', ''), 'missing'),
      coalesce((v_line->>'unitMismatch')::boolean, false),
      coalesce((v_line->>'excluded')::boolean, false),
      coalesce((v_line->>'alreadyOnList')::boolean, false),
      nullif(v_line->>'existingListItemId', '')::uuid,
      v_i
    );
    v_i := v_i + 1;
  end loop;

  return v_proposal_id;
end;
$$;

revoke all on function public.persist_rediscovery_ingredient_proposal(uuid, uuid, jsonb, text) from public;
grant execute on function public.persist_rediscovery_ingredient_proposal(uuid, uuid, jsonb, text) to authenticated;

create or replace function public.confirm_rediscovery_ingredient_proposal(
  p_proposal_id uuid,
  p_excluded_line_ids uuid[] default '{}',
  p_quantity_overrides jsonb default '{}'::jsonb,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prop public.recipe_rediscovery_ingredient_proposals%rowtype;
  v_actor uuid;
  v_line record;
  v_list uuid;
  v_qty numeric;
  v_item_id uuid;
  v_results jsonb := '[]'::jsonb;
  v_ok boolean;
  v_err text;
  v_created uuid[] := '{}';
begin
  perform set_config('householdos.resource_mutation', 'rpc', true);
  select * into v_prop from public.recipe_rediscovery_ingredient_proposals where id = p_proposal_id for update;
  if not found then raise exception 'Proposal not found'; end if;
  v_actor := public._shopping_intel_actor(v_prop.household_id);

  if v_prop.status = 'confirmed' then
    return jsonb_build_object('proposalId', v_prop.id, 'status', 'confirmed', 'results', '[]'::jsonb, 'idempotent', true);
  end if;
  if v_prop.status <> 'draft' then
    raise exception 'Proposal is not draft';
  end if;
  if v_prop.expires_at < now() then
    update public.recipe_rediscovery_ingredient_proposals set status = 'expired' where id = v_prop.id;
    raise exception 'Proposal expired; rebuild missing ingredients';
  end if;

  v_list := coalesce(v_prop.list_id, public.ensure_default_shopping_list(v_prop.household_id));

  for v_line in
    select * from public.recipe_rediscovery_ingredient_proposal_lines
    where proposal_id = p_proposal_id
    order by sort_order
  loop
    if v_line.id = any(coalesce(p_excluded_line_ids, '{}'::uuid[])) or v_line.excluded then
      update public.recipe_rediscovery_ingredient_proposal_lines set excluded = true where id = v_line.id;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'lineId', v_line.id, 'ok', true, 'skipped', true, 'reason', 'excluded'
      ));
      continue;
    end if;

    if v_line.line_status in ('available', 'optional', 'probably_available') then
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'lineId', v_line.id, 'ok', true, 'skipped', true, 'reason', v_line.line_status
      ));
      continue;
    end if;

    v_ok := true;
    v_err := null;
    v_item_id := null;
    begin
      v_qty := coalesce(
        nullif(p_quantity_overrides->>v_line.id::text, '')::numeric,
        v_line.shortfall_quantity,
        v_line.required_quantity,
        1
      );

      if v_line.existing_list_item_id is not null and v_line.already_on_list then
        update public.shopping_list_items set
          quantity = case
            when quantity is null then v_qty
            when v_qty is not null and quantity < v_qty then v_qty
            else quantity
          end,
          updated_at = now()
        where id = v_line.existing_list_item_id
          and household_id = v_prop.household_id
          and status in ('requested', 'approved', 'assigned', 'in_cart')
        returning id into v_item_id;
      end if;

      if v_item_id is null then
        insert into public.shopping_list_items(
          list_id, household_id, name, category, requested_by_membership_id,
          quantity, quantity_unit, quantity_is_approximate, status,
          related_recipe_id, related_recipe_ingredient_id,
          required_quantity, pantry_shortfall_quantity
        ) values (
          v_list, v_prop.household_id, v_line.display_name, 'groceries', v_actor,
          v_qty, v_line.quantity_unit, true, 'requested',
          v_prop.recipe_id, v_line.recipe_ingredient_id,
          v_line.required_quantity, v_qty
        )
        returning id into v_item_id;
      end if;

      update public.recipe_rediscovery_ingredient_proposal_lines
      set shopping_list_item_id = v_item_id
      where id = v_line.id;

      insert into public.recipe_rediscovery_shopping_item_links (
        household_id, suggestion_id, proposal_id, proposal_line_id, shopping_item_id
      ) values (
        v_prop.household_id, v_prop.suggestion_id, v_prop.id, v_line.id, v_item_id
      )
      on conflict (proposal_line_id) do nothing;

      v_created := array_append(v_created, v_item_id);
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'lineId', v_line.id, 'ok', true, 'shoppingItemId', v_item_id
      ));
    exception when others then
      v_ok := false;
      v_err := sqlerrm;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'lineId', v_line.id, 'ok', false, 'error', v_err
      ));
    end;
  end loop;

  update public.recipe_rediscovery_ingredient_proposals
  set status = 'confirmed', confirmed_at = now(), list_id = v_list
  where id = v_prop.id;

  -- Mark rediscovery decision only after confirmed creates
  perform public.decide_recipe_rediscovery(
    v_prop.suggestion_id,
    'add_ingredients',
    coalesce(p_idempotency_key, 'confirm-' || v_prop.id::text)
  );

  update public.recipe_rediscovery_decisions
  set resulting_shopping_item_ids = v_created
  where suggestion_id = v_prop.suggestion_id
    and decision = 'add_ingredients'
    and actor_membership_id = v_actor
    and created_at > now() - interval '1 minute';

  return jsonb_build_object(
    'proposalId', v_prop.id,
    'status', 'confirmed',
    'results', v_results,
    'createdCount', coalesce(cardinality(v_created), 0)
  );
end;
$$;

revoke all on function public.confirm_rediscovery_ingredient_proposal(uuid, uuid[], jsonb, text) from public;
grant execute on function public.confirm_rediscovery_ingredient_proposal(uuid, uuid[], jsonb, text) to authenticated;
