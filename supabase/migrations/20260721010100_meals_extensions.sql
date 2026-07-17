-- Phase 6.5: extend pantry, shopping, calendar for meals

-- Pantry staples
alter table public.pantry_items
  add column if not exists is_staple boolean not null default false;

-- Shopping item meal linkage
alter table public.shopping_list_items
  add column if not exists related_meal_request_id uuid,
  add column if not exists related_meal_plan_id uuid,
  add column if not exists related_recipe_id uuid,
  add column if not exists related_recipe_ingredient_id uuid,
  add column if not exists required_quantity numeric(12,3),
  add column if not exists pantry_shortfall_quantity numeric(12,3);

-- Composite FKs (same household)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'shopping_list_items_meal_plan_fk'
  ) then
    alter table public.shopping_list_items
      add constraint shopping_list_items_meal_plan_fk
      foreign key (related_meal_plan_id, household_id)
      references public.meal_plans(id, household_id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'shopping_list_items_meal_request_fk'
  ) then
    alter table public.shopping_list_items
      add constraint shopping_list_items_meal_request_fk
      foreign key (related_meal_request_id, household_id)
      references public.meal_requests(id, household_id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'shopping_list_items_recipe_fk'
  ) then
    alter table public.shopping_list_items
      add constraint shopping_list_items_recipe_fk
      foreign key (related_recipe_id, household_id)
      references public.recipes(id, household_id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'shopping_list_items_recipe_ingredient_fk'
  ) then
    alter table public.shopping_list_items
      add constraint shopping_list_items_recipe_ingredient_fk
      foreign key (related_recipe_ingredient_id, household_id)
      references public.recipe_ingredients(id, household_id) on delete set null;
  end if;
end $$;

create unique index if not exists shopping_list_items_active_meal_ingredient_uidx
  on public.shopping_list_items(related_meal_plan_id, related_recipe_ingredient_id)
  where related_meal_plan_id is not null
    and related_recipe_ingredient_id is not null
    and status in ('requested','approved','assigned','in_cart');

-- Calendar: add meal_prep category
alter table public.calendar_events drop constraint if exists calendar_events_category_check;
alter table public.calendar_events add constraint calendar_events_category_check check (category in (
  'household_meeting',
  'social',
  'shared_meal',
  'meal_prep',
  'guest_visit',
  'maintenance',
  'cleaning',
  'grocery_trip',
  'bill_deadline',
  'move_in_out',
  'personal',
  'other'
));
