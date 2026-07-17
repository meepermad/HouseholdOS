-- Phase 6.5: recipes, meal plans, meal requests, shopping prep, meal-prep batches

-- ---------------------------------------------------------------------------
-- household_meal_settings
-- ---------------------------------------------------------------------------
create table public.household_meal_settings (
  household_id uuid primary key references public.households(id) on delete restrict,
  assume_staples_available boolean not null default false,
  shopping_prep_policy text not null default 'suggest_and_confirm'
    check (shopping_prep_policy in ('manual', 'suggest_and_confirm', 'automatic_on_acceptance')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- recipes
-- ---------------------------------------------------------------------------
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  created_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 200),
  normalized_name text not null check (char_length(normalized_name) between 1 and 200),
  description text check (description is null or char_length(description) <= 4000),
  category text not null default 'other' check (category in (
    'breakfast','lunch','dinner','snack','dessert','side','soup_stew','salad',
    'sandwich_wrap','pasta','rice_grain','baked','slow_cooker','grill','meal_prep','other'
  )),
  cuisine_label text check (cuisine_label is null or char_length(cuisine_label) <= 120),
  base_servings numeric(8,2) not null default 4 check (base_servings > 0),
  prep_minutes integer check (prep_minutes is null or prep_minutes >= 0),
  cook_minutes integer check (cook_minutes is null or cook_minutes >= 0),
  total_minutes integer check (total_minutes is null or total_minutes >= 0),
  difficulty text not null default 'unknown' check (difficulty in ('easy','medium','hard','unknown')),
  visibility text not null default 'household' check (visibility in (
    'household','creator_only','selected_members'
  )),
  source_type text not null default 'manual' check (source_type in ('manual','url_reference','other')),
  source_url text check (source_url is null or char_length(source_url) <= 2000),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (id, household_id)
);

create index recipes_household_idx on public.recipes(household_id) where archived_at is null;
create index recipes_household_category_idx on public.recipes(household_id, category) where archived_at is null;
create index recipes_normalized_name_idx on public.recipes(household_id, normalized_name);
create index recipes_visibility_idx on public.recipes(household_id, visibility);

create table public.recipe_visibility_members (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  membership_id uuid not null references public.household_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (recipe_id, membership_id),
  foreign key (recipe_id, household_id) references public.recipes(id, household_id) on delete cascade
);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  display_name text not null check (char_length(trim(display_name)) between 1 and 200),
  normalized_name text not null check (char_length(normalized_name) between 1 and 200),
  quantity numeric(12,3),
  quantity_unit text not null default 'item' check (quantity_unit in (
    'item','pack','roll','bottle','box','bag','can','jar','ounce','pound','gram',
    'kilogram','milliliter','liter','cup','tablespoon','teaspoon','serving','unknown'
  )),
  quantity_mode text not null default 'exact' check (quantity_mode in (
    'exact','approximate','to_taste','as_needed','optional'
  )),
  preparation_note text check (preparation_note is null or char_length(preparation_note) <= 500),
  ingredient_group text check (ingredient_group is null or char_length(ingredient_group) <= 120),
  required boolean not null default true,
  pantry_match_behavior text not null default 'match' check (pantry_match_behavior in (
    'match','skip','staple'
  )),
  substitution_notes text check (substitution_notes is null or char_length(substitution_notes) <= 1000),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (id, household_id),
  foreign key (recipe_id, household_id) references public.recipes(id, household_id) on delete cascade
);

create index recipe_ingredients_recipe_idx on public.recipe_ingredients(recipe_id, sort_order);
create index recipe_ingredients_normalized_idx on public.recipe_ingredients(household_id, normalized_name);

create table public.recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  step_number integer not null check (step_number >= 1),
  instruction text not null check (char_length(trim(instruction)) between 1 and 4000),
  duration_minutes integer check (duration_minutes is null or duration_minutes >= 0),
  timer_label text check (timer_label is null or char_length(timer_label) <= 120),
  phase text not null default 'cooking' check (phase in ('preparation','cooking','finishing','other')),
  equipment_note text check (equipment_note is null or char_length(equipment_note) <= 500),
  created_at timestamptz not null default now(),
  unique (recipe_id, step_number),
  foreign key (recipe_id, household_id) references public.recipes(id, household_id) on delete cascade
);

create table public.recipe_equipment (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  display_name text not null check (char_length(trim(display_name)) between 1 and 200),
  inventory_item_id uuid,
  required boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  foreign key (recipe_id, household_id) references public.recipes(id, household_id) on delete cascade,
  foreign key (inventory_item_id, household_id) references public.inventory_items(id, household_id) on delete set null
);

create table public.recipe_ingredient_aliases (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade,
  canonical_name text not null check (char_length(trim(canonical_name)) between 1 and 200),
  alias_name text not null check (char_length(trim(alias_name)) between 1 and 200),
  created_at timestamptz not null default now(),
  unique (household_id, alias_name)
);

create index recipe_ingredient_aliases_canonical_idx
  on public.recipe_ingredient_aliases(household_id, canonical_name);

create table public.recipe_user_preferences (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  recipe_id uuid not null,
  membership_id uuid not null references public.household_memberships(id) on delete restrict,
  is_favorite boolean not null default false,
  would_make_again boolean,
  personal_rating integer check (personal_rating is null or (personal_rating between 1 and 5)),
  household_rating integer check (household_rating is null or (household_rating between 1 and 5)),
  last_prepared_at timestamptz,
  times_prepared integer not null default 0 check (times_prepared >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recipe_id, membership_id),
  foreign key (recipe_id, household_id) references public.recipes(id, household_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- dietary preferences (owner-controlled)
-- ---------------------------------------------------------------------------
create table public.member_dietary_preferences (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  membership_id uuid not null references public.household_memberships(id) on delete restrict,
  label text not null check (char_length(trim(label)) between 1 and 120),
  share_identity_with_organizer boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (membership_id, label)
);

-- ---------------------------------------------------------------------------
-- meal_requests
-- ---------------------------------------------------------------------------
create table public.meal_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  created_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  meal_type text not null default 'shared_household' check (meal_type in (
    'shared_household','guest_inclusive','personal','open_household','meal_prep'
  )),
  target_date date,
  date_range_end date,
  expected_household_attendees integer check (expected_household_attendees is null or expected_household_attendees >= 0),
  guest_count integer not null default 0 check (guest_count >= 0 and guest_count <= 20),
  desired_servings numeric(8,2) check (desired_servings is null or desired_servings > 0),
  max_prep_minutes integer check (max_prep_minutes is null or max_prep_minutes >= 0),
  max_total_minutes integer check (max_total_minutes is null or max_total_minutes >= 0),
  max_missing_ingredients integer check (max_missing_ingredients is null or max_missing_ingredients >= 0),
  pantry_only boolean not null default false,
  note text check (note is null or char_length(note) <= 2000),
  status text not null default 'open' check (status in (
    'open','ranked','accepted','dismissed','expired'
  )),
  accepted_meal_plan_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id)
);

create index meal_requests_household_idx on public.meal_requests(household_id, status, created_at desc);

create table public.meal_request_constraints (
  id uuid primary key default gen_random_uuid(),
  meal_request_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  constraint_type text not null check (constraint_type in (
    'exclude_ingredient','prioritize_ingredient','category','cuisine','equipment','dietary'
  )),
  value text not null check (char_length(trim(value)) between 1 and 200),
  created_at timestamptz not null default now(),
  foreign key (meal_request_id, household_id) references public.meal_requests(id, household_id) on delete cascade
);

create table public.meal_request_results (
  id uuid primary key default gen_random_uuid(),
  meal_request_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  recipe_id uuid not null,
  rank_position integer not null check (rank_position >= 1),
  score numeric(10,2) not null default 0,
  explanation jsonb not null default '[]'::jsonb,
  missing_required integer not null default 0,
  created_at timestamptz not null default now(),
  unique (meal_request_id, recipe_id),
  foreign key (meal_request_id, household_id) references public.meal_requests(id, household_id) on delete cascade,
  foreign key (recipe_id, household_id) references public.recipes(id, household_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- meal_plans
-- ---------------------------------------------------------------------------
create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  created_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  organizer_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  meal_type text not null check (meal_type in (
    'shared_household','guest_inclusive','personal','open_household','meal_prep'
  )),
  title text not null check (char_length(trim(title)) between 1 and 200),
  recipe_id uuid,
  custom_meal_name text check (custom_meal_name is null or char_length(custom_meal_name) <= 200),
  meal_date date not null,
  starts_at timestamptz,
  ends_at timestamptz,
  time_zone text not null default 'America/Chicago',
  calendar_event_id uuid references public.calendar_events(id) on delete set null,
  meal_request_id uuid,
  visibility text not null default 'household' check (visibility in (
    'household','participants','creator_only'
  )),
  status text not null default 'draft' check (status in (
    'draft','planned','shopping_needed','ready','preparing','prepared','cancelled'
  )),
  target_servings numeric(8,2) not null default 4 check (target_servings > 0),
  buffer_servings numeric(8,2) not null default 0 check (buffer_servings >= 0),
  desired_leftover_servings numeric(8,2) not null default 0 check (desired_leftover_servings >= 0),
  guest_count integer not null default 0 check (guest_count >= 0 and guest_count <= 20),
  possible_guest_count integer not null default 0 check (possible_guest_count >= 0 and possible_guest_count <= 20),
  guest_label text check (guest_label is null or char_length(guest_label) <= 120),
  guest_dietary_note text check (guest_dietary_note is null or char_length(guest_dietary_note) <= 240),
  guest_cost_policy text not null default 'manual' check (guest_cost_policy in (
    'host_covers','participants_share','organizer_covers','excluded_from_split','manual'
  )),
  host_membership_id uuid references public.household_memberships(id) on delete restrict,
  cooking_membership_id uuid references public.household_memberships(id) on delete restrict,
  cleanup_membership_id uuid references public.household_memberships(id) on delete restrict,
  notes text check (notes is null or char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  prepared_at timestamptz,
  unique (id, household_id),
  foreign key (recipe_id, household_id) references public.recipes(id, household_id) on delete set null,
  foreign key (meal_request_id, household_id) references public.meal_requests(id, household_id) on delete set null
);

create index meal_plans_household_date_idx on public.meal_plans(household_id, meal_date);
create index meal_plans_household_status_idx on public.meal_plans(household_id, status);
create index meal_plans_calendar_idx on public.meal_plans(calendar_event_id) where calendar_event_id is not null;

alter table public.meal_requests
  add constraint meal_requests_accepted_plan_fk
  foreign key (accepted_meal_plan_id, household_id)
  references public.meal_plans(id, household_id) on delete set null;

create table public.meal_attendees (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  membership_id uuid not null references public.household_memberships(id) on delete restrict,
  attendance_status text not null default 'no_response' check (attendance_status in (
    'going','maybe','not_going','no_response'
  )),
  guest_count integer not null default 0 check (guest_count >= 0 and guest_count <= 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meal_plan_id, membership_id),
  foreign key (meal_plan_id, household_id) references public.meal_plans(id, household_id) on delete cascade
);

create table public.meal_plan_ingredients (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  recipe_ingredient_id uuid,
  display_name text not null check (char_length(trim(display_name)) between 1 and 200),
  normalized_name text not null,
  required_quantity numeric(12,3),
  scaled_quantity numeric(12,3),
  quantity_unit text not null default 'item',
  quantity_mode text not null default 'exact',
  required boolean not null default true,
  pantry_match_status text,
  pantry_item_id uuid,
  pantry_shortfall_quantity numeric(12,3),
  shopping_list_item_id uuid,
  checklist_status text not null default 'needed' check (checklist_status in (
    'needed','on_shopping_list','purchased','available','skipped'
  )),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (meal_plan_id, household_id) references public.meal_plans(id, household_id) on delete cascade,
  foreign key (recipe_ingredient_id, household_id) references public.recipe_ingredients(id, household_id) on delete set null,
  foreign key (pantry_item_id, household_id) references public.pantry_items(id, household_id) on delete set null
);

create table public.meal_plan_assignments (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  assignment_type text not null check (assignment_type in (
    'cooking','prep_assist','cleanup','leftover_storage'
  )),
  membership_id uuid not null references public.household_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (meal_plan_id, assignment_type, membership_id),
  foreign key (meal_plan_id, household_id) references public.meal_plans(id, household_id) on delete cascade
);

create table public.meal_plan_chore_links (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  chore_occurrence_id uuid,
  link_kind text not null check (link_kind in (
    'cooking','prep_assist','cleanup','leftover_storage'
  )),
  created_at timestamptz not null default now(),
  foreign key (meal_plan_id, household_id) references public.meal_plans(id, household_id) on delete cascade,
  foreign key (chore_occurrence_id, household_id) references public.chore_occurrences(id, household_id) on delete cascade
);

create table public.meal_plan_expense_links (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  expense_id uuid not null,
  suggestion jsonb,
  created_at timestamptz not null default now(),
  foreign key (meal_plan_id, household_id) references public.meal_plans(id, household_id) on delete cascade,
  foreign key (expense_id, household_id) references public.expenses(id, household_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- shopping proposals
-- ---------------------------------------------------------------------------
create table public.meal_shopping_proposals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  meal_plan_id uuid not null,
  meal_request_id uuid,
  status text not null default 'draft' check (status in (
    'draft','confirmed','superseded','cancelled'
  )),
  shopping_list_id uuid,
  policy_snapshot text not null default 'suggest_and_confirm',
  created_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  foreign key (meal_plan_id, household_id) references public.meal_plans(id, household_id) on delete cascade,
  foreign key (meal_request_id, household_id) references public.meal_requests(id, household_id) on delete set null,
  foreign key (shopping_list_id, household_id) references public.shopping_lists(id, household_id) on delete set null
);

create table public.meal_shopping_proposal_lines (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  recipe_ingredient_id uuid,
  display_name text not null,
  line_status text not null,
  required_quantity numeric(12,3),
  shortfall_quantity numeric(12,3),
  quantity_unit text not null default 'item',
  excluded boolean not null default false,
  substitute_name text,
  shopping_list_item_id uuid,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  foreign key (proposal_id, household_id) references public.meal_shopping_proposals(id, household_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- meal-prep batches (no portion ownership)
-- ---------------------------------------------------------------------------
create table public.meal_prep_batches (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  meal_plan_id uuid,
  recipe_id uuid,
  name text not null check (char_length(trim(name)) between 1 and 200),
  prepared_at timestamptz not null default now(),
  prepared_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  availability text not null default 'household' check (availability in (
    'household','personal','selected_members','open_household'
  )),
  owner_membership_id uuid references public.household_memberships(id) on delete restrict,
  approximate_starting_quantity numeric(12,3),
  quantity_unit text not null default 'serving',
  remaining_state text not null default 'plenty' check (remaining_state in (
    'plenty','about_half','low','finished','unknown'
  )),
  location_id uuid,
  review_by date,
  use_by date,
  related_pantry_item_id uuid,
  notes text check (notes is null or char_length(notes) <= 2000),
  finished_at timestamptz,
  discarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  foreign key (meal_plan_id, household_id) references public.meal_plans(id, household_id) on delete set null,
  foreign key (recipe_id, household_id) references public.recipes(id, household_id) on delete set null,
  foreign key (location_id, household_id) references public.household_locations(id, household_id) on delete set null,
  foreign key (related_pantry_item_id, household_id) references public.pantry_items(id, household_id) on delete set null,
  -- Explicit: no portion claim columns exist on this table.
  check (
    (availability = 'personal' and owner_membership_id is not null)
    or (availability <> 'personal')
  )
);

create index meal_prep_batches_household_idx on public.meal_prep_batches(household_id, prepared_at desc);
create index meal_prep_batches_review_idx on public.meal_prep_batches(household_id, review_by)
  where review_by is not null and finished_at is null and discarded_at is null;

create table public.meal_batch_stock_events (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  event_type text not null check (event_type in (
    'created','remaining_updated','finished','discarded','corrected'
  )),
  previous_remaining_state text,
  new_remaining_state text,
  note text check (note is null or char_length(note) <= 2000),
  recorded_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (batch_id, household_id) references public.meal_prep_batches(id, household_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger recipes_set_updated_at before update on public.recipes
  for each row execute function public.set_updated_at();
create trigger meal_plans_set_updated_at before update on public.meal_plans
  for each row execute function public.set_updated_at();
create trigger meal_requests_set_updated_at before update on public.meal_requests
  for each row execute function public.set_updated_at();
create trigger household_meal_settings_set_updated_at before update on public.household_meal_settings
  for each row execute function public.set_updated_at();
create trigger meal_prep_batches_set_updated_at before update on public.meal_prep_batches
  for each row execute function public.set_updated_at();
create trigger recipe_user_preferences_set_updated_at before update on public.recipe_user_preferences
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RPC-only mutation guards
-- ---------------------------------------------------------------------------
create or replace function public.enforce_meal_rpc_only() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null
     and current_setting('householdos.meal_mutation', true) is distinct from 'rpc'
     and current_setting('householdos.privileged_mutation', true) is distinct from 'on'
     and current_setting('householdos.resource_mutation', true) is distinct from 'rpc' then
    raise exception 'Meal records may only be written by secure functions';
  end if;
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'household_meal_settings','recipes','recipe_visibility_members','recipe_ingredients',
    'recipe_steps','recipe_equipment','recipe_ingredient_aliases','recipe_user_preferences',
    'member_dietary_preferences','meal_requests','meal_request_constraints','meal_request_results',
    'meal_plans','meal_attendees','meal_plan_ingredients','meal_plan_assignments',
    'meal_plan_chore_links','meal_plan_expense_links','meal_shopping_proposals',
    'meal_shopping_proposal_lines','meal_prep_batches','meal_batch_stock_events'
  ]
  loop
    execute format(
      'create trigger %I_rpc_only before insert or update or delete on public.%I for each row execute function public.enforce_meal_rpc_only()',
      t, t
    );
  end loop;
end $$;

-- Seed common aliases (household_id null = global)
insert into public.recipe_ingredient_aliases (household_id, canonical_name, alias_name) values
  (null, 'bell pepper', 'capsicum'),
  (null, 'bell pepper', 'sweet pepper'),
  (null, 'green onion', 'scallion'),
  (null, 'green onion', 'spring onion'),
  (null, 'chickpea', 'garbanzo bean'),
  (null, 'chickpea', 'garbanzo'),
  (null, 'cilantro', 'coriander leaf'),
  (null, 'zucchini', 'courgette'),
  (null, 'eggplant', 'aubergine'),
  (null, 'heavy cream', 'whipping cream'),
  (null, 'confectioners sugar', 'powdered sugar'),
  (null, 'all purpose flour', 'plain flour');
