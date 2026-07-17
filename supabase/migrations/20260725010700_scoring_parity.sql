-- Phase 8 tech debt: align recommendation mode multipliers with TypeScript weights.ts

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
    when p_mode = 'meal_prep_friendly' and p_key = 'time_fit' then 0.8
    when p_mode = 'guest_friendly' and p_key = 'guest_fit' then 2.5
    when p_mode = 'guest_friendly' and p_key = 'serving_scalability' then 1.6
    when p_mode = 'guest_friendly' and p_key = 'strong_dislike_penalty' then 1.3
    when p_mode = 'something_different' and p_key = 'recently_prepared_penalty' then 2.2
    when p_mode = 'something_different' and p_key = 'category_repetition_penalty' then 2.0
    when p_mode = 'something_different' and p_key = 'novelty_bonus' then 2.5
    when p_mode = 'something_different' and p_key = 'favorite_bonus' then 0.5
    else 1.0
  end;
$$;

-- Queryable weight table for TypeScript ↔ SQL parity tests
create or replace function public.recommendation_weight_table()
returns table(mode text, component_key text, weight numeric)
language sql
stable
security definer
set search_path = public
as $$
  select m.mode, k.component_key,
         public._recommendation_weight(m.mode, k.component_key) as weight
  from (
    values
      ('best_overall'),
      ('use_what_we_have'),
      ('use_food_soon'),
      ('household_favorite'),
      ('fastest'),
      ('fewest_missing_items'),
      ('meal_prep_friendly'),
      ('guest_friendly'),
      ('something_different')
  ) as m(mode)
  cross join (
    values
      ('pantry_coverage'),
      ('use_soon_utilization'),
      ('missing_required_count'),
      ('missing_optional_count'),
      ('unit_uncertainty'),
      ('attendee_preference'),
      ('strong_dislike_penalty'),
      ('favorite_bonus'),
      ('time_fit'),
      ('meal_type_fit'),
      ('equipment_fit'),
      ('serving_scalability'),
      ('meal_prep_fit'),
      ('guest_fit'),
      ('recently_prepared_penalty'),
      ('category_repetition_penalty'),
      ('shopping_cost_estimate'),
      ('novelty_bonus')
  ) as k(component_key);
$$;

revoke all on function public.recommendation_weight_table() from public, anon;
grant execute on function public.recommendation_weight_table() to authenticated, service_role;
