-- Shopping Intelligence + Forgotten Favorites schema

-- ---------------------------------------------------------------------------
-- Household shopping recommendation preferences
-- ---------------------------------------------------------------------------
create table if not exists public.shopping_recommendation_preferences (
  household_id uuid primary key references public.households(id) on delete cascade,
  enabled boolean not null default true,
  include_supply_forecasts boolean not null default true,
  include_recurring_staples boolean not null default true,
  include_proposed_meal_ingredients boolean not null default true,
  include_guest_needs boolean not null default true,
  forecast_confidence_threshold text not null default 'medium'
    check (forecast_confidence_threshold in ('low', 'medium', 'high')),
  recommendation_horizon_days integer not null default 10
    check (recommendation_horizon_days between 1 and 60),
  default_list_id uuid,
  show_personal_separately boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by_membership_id uuid references public.household_memberships(id) on delete set null,
  foreign key (default_list_id, household_id)
    references public.shopping_lists(id, household_id) on delete set null
);

-- ---------------------------------------------------------------------------
-- Recipe rediscovery preferences
-- ---------------------------------------------------------------------------
create table if not exists public.recipe_rediscovery_preferences (
  household_id uuid primary key references public.households(id) on delete cascade,
  enabled boolean not null default true,
  cadence text not null default 'smart'
    check (cadence in ('off', 'weekly', 'every_other_trip', 'monthly', 'smart')),
  min_days_since_prepared integer not null default 45
    check (min_days_since_prepared between 7 and 365),
  max_suggestions_per_trip integer not null default 2
    check (max_suggestions_per_trip between 0 and 5),
  allow_push_reminders boolean not null default true,
  include_guest_friendly boolean not null default true,
  include_meal_prep_favorites boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by_membership_id uuid references public.household_memberships(id) on delete set null
);

-- ---------------------------------------------------------------------------
-- Recommendation runs + items + sources
-- ---------------------------------------------------------------------------
create table if not exists public.shopping_recommendation_runs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  list_id uuid,
  scope text not null default 'shared'
    check (scope in ('shared', 'personal', 'selected_members')),
  viewer_membership_id uuid not null references public.household_memberships(id) on delete cascade,
  scoring_version text not null default '1',
  mode_filter text not null default 'everything'
    check (mode_filter in (
      'everything', 'planned_meals', 'running_low', 'run_out_soon',
      'open_requests', 'recurring_staples', 'guest_event', 'forgotten'
    )),
  status text not null default 'ready'
    check (status in ('generating', 'ready', 'stale', 'expired')),
  source_freshness jsonb not null default '{}'::jsonb,
  client_idempotency_key text,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  foreign key (list_id, household_id)
    references public.shopping_lists(id, household_id) on delete set null,
  unique (household_id, client_idempotency_key),
  unique (id, household_id)
);

create index shopping_recommendation_runs_household_idx
  on public.shopping_recommendation_runs(household_id, created_at desc);

create table if not exists public.shopping_recommendation_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.shopping_recommendation_runs(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  list_id uuid,
  name text not null check (char_length(trim(name)) between 1 and 160),
  normalized_key text not null,
  priority_band text not null
    check (priority_band in ('urgent', 'recommended', 'consider')),
  suggested_quantity numeric,
  suggested_unit text not null default 'item',
  quantity_breakdown jsonb not null default '[]'::jsonb,
  unit_mismatch boolean not null default false,
  visibility text not null default 'shared'
    check (visibility in ('shared', 'personal', 'selected_members')),
  owner_membership_id uuid references public.household_memberships(id) on delete set null,
  related_supply_id uuid,
  related_pantry_id uuid,
  related_inventory_id uuid,
  related_product_id uuid,
  explanation text not null,
  reason_codes text[] not null default '{}',
  confidence text not null default 'medium'
    check (confidence in ('low', 'medium', 'high')),
  status text not null default 'suggested'
    check (status in (
      'suggested', 'added', 'dismissed', 'snoozed', 'stale', 'fulfilled', 'expired', 'suppressed'
    )),
  existing_list_item_id uuid,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (run_id, household_id)
    references public.shopping_recommendation_runs(id, household_id) on delete cascade,
  foreign key (list_id, household_id)
    references public.shopping_lists(id, household_id) on delete set null
);

create index shopping_recommendation_items_run_idx
  on public.shopping_recommendation_items(run_id, sort_order);
create index shopping_recommendation_items_status_idx
  on public.shopping_recommendation_items(household_id, status);

create table if not exists public.shopping_recommendation_sources (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.shopping_recommendation_items(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  source_type text not null,
  source_id uuid,
  reason_code text not null,
  explanation text not null,
  quantity numeric,
  quantity_unit text,
  created_at timestamptz not null default now()
);

create index shopping_recommendation_sources_item_idx
  on public.shopping_recommendation_sources(item_id);

create table if not exists public.shopping_recommendation_decisions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  item_id uuid not null references public.shopping_recommendation_items(id) on delete cascade,
  actor_membership_id uuid not null references public.household_memberships(id) on delete cascade,
  decision text not null
    check (decision in (
      'added', 'dismissed', 'snoozed', 'suppress_auto', 'no_longer_use', 'split', 'quantity_corrected'
    )),
  note text,
  snooze_until timestamptz,
  resulting_shopping_item_id uuid,
  client_idempotency_key text,
  created_at timestamptz not null default now(),
  unique (household_id, client_idempotency_key)
);

-- ---------------------------------------------------------------------------
-- Shopping trip sessions
-- ---------------------------------------------------------------------------
create table if not exists public.shopping_trip_sessions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  list_id uuid not null,
  started_by_membership_id uuid not null references public.household_memberships(id) on delete cascade,
  store_label text,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'abandoned')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  client_idempotency_key text,
  foreign key (list_id, household_id)
    references public.shopping_lists(id, household_id) on delete cascade,
  unique (household_id, client_idempotency_key)
);

create index shopping_trip_sessions_list_idx
  on public.shopping_trip_sessions(list_id, started_at desc);

create table if not exists public.shopping_trip_events (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.shopping_trip_sessions(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  shopping_item_id uuid,
  event_type text not null
    check (event_type in (
      'checked', 'unchecked', 'unavailable', 'substituted', 'added_unexpected',
      'quantity_edited', 'still_needed'
    )),
  payload jsonb not null default '{}'::jsonb,
  actor_membership_id uuid not null references public.household_memberships(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index shopping_trip_events_trip_idx
  on public.shopping_trip_events(trip_id, created_at);

-- ---------------------------------------------------------------------------
-- Forgotten favorites / rediscovery
-- ---------------------------------------------------------------------------
create table if not exists public.recipe_suggestion_snoozes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  recipe_id uuid not null,
  membership_id uuid references public.household_memberships(id) on delete cascade,
  scope text not null default 'household'
    check (scope in ('household', 'member')),
  reason text not null default 'snooze'
    check (reason in ('snooze', 'not_this_time', 'recently_had', 'suppress')),
  snooze_until timestamptz,
  created_at timestamptz not null default now(),
  unique (household_id, recipe_id, membership_id, reason)
);

create table if not exists public.recipe_rediscovery_suggestions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  recipe_id uuid not null,
  list_id uuid,
  trip_id uuid references public.shopping_trip_sessions(id) on delete set null,
  viewer_membership_id uuid not null references public.household_memberships(id) on delete cascade,
  scoring_version text not null default '1',
  score numeric not null default 0,
  explanation text not null,
  reason_codes text[] not null default '{}',
  pantry_have integer not null default 0,
  pantry_total integer not null default 0,
  missing_summary jsonb not null default '[]'::jsonb,
  preference_fit text not null default 'unknown',
  status text not null default 'suggested'
    check (status in (
      'suggested', 'planned', 'ingredients_added', 'saved', 'dismissed',
      'snoozed', 'suppressed', 'expired'
    )),
  shown_at timestamptz not null default now(),
  expires_at timestamptz,
  client_idempotency_key text,
  unique (household_id, client_idempotency_key)
);

create index recipe_rediscovery_suggestions_household_idx
  on public.recipe_rediscovery_suggestions(household_id, shown_at desc);

create table if not exists public.recipe_rediscovery_decisions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  suggestion_id uuid not null references public.recipe_rediscovery_suggestions(id) on delete cascade,
  recipe_id uuid not null,
  actor_membership_id uuid not null references public.household_memberships(id) on delete cascade,
  decision text not null
    check (decision in (
      'plan', 'add_ingredients', 'save_for_later', 'not_this_time',
      'remind_next_month', 'recently_had', 'suppress'
    )),
  resulting_meal_plan_id uuid,
  resulting_shopping_item_ids uuid[] not null default '{}',
  client_idempotency_key text,
  created_at timestamptz not null default now(),
  unique (household_id, client_idempotency_key)
);
