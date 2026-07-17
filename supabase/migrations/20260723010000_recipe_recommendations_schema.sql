-- Phase 7A: preference-aware recommendation schema extensions

-- ---------------------------------------------------------------------------
-- Extend recipe_user_preferences
-- ---------------------------------------------------------------------------
alter table public.recipe_user_preferences
  add column if not exists preference_signal text not null default 'have_not_tried'
    check (preference_signal in (
      'favorite','would_make_again','okay','would_not_choose_again','have_not_tried'
    )),
  add column if not exists taste integer check (taste is null or (taste between 1 and 5)),
  add column if not exists ease integer check (ease is null or (ease between 1 and 5)),
  add column if not exists cost integer check (cost is null or (cost between 1 and 5)),
  add column if not exists meal_prep_usefulness integer
    check (meal_prep_usefulness is null or (meal_prep_usefulness between 1 and 5)),
  add column if not exists guest_friendliness integer
    check (guest_friendliness is null or (guest_friendliness between 1 and 5)),
  add column if not exists private_note text
    check (private_note is null or char_length(private_note) <= 500),
  add column if not exists share_identity_with_organizer boolean not null default false;

-- Backfill preference_signal from legacy columns
update public.recipe_user_preferences
set preference_signal = case
  when is_favorite then 'favorite'
  when would_make_again is true then 'would_make_again'
  when would_make_again is false then 'would_not_choose_again'
  when personal_rating is not null and personal_rating >= 4 then 'would_make_again'
  when personal_rating is not null and personal_rating <= 2 then 'would_not_choose_again'
  when personal_rating is not null then 'okay'
  else 'have_not_tried'
end
where preference_signal = 'have_not_tried'
  and (is_favorite or would_make_again is not null or personal_rating is not null);

-- ---------------------------------------------------------------------------
-- Extend meal_requests
-- ---------------------------------------------------------------------------
alter table public.meal_requests
  add column if not exists ranking_mode text not null default 'best_overall'
    check (ranking_mode in (
      'best_overall','use_what_we_have','use_food_soon','household_favorite',
      'fastest','fewest_missing_items','meal_prep_friendly','guest_friendly',
      'something_different'
    )),
  add column if not exists preference_scope text not null default 'attendees'
    check (preference_scope in ('attendees','household')),
  add column if not exists strict_time_limit boolean not null default false,
  add column if not exists inputs_changed_at timestamptz,
  add column if not exists last_recommendation_run_id uuid;

-- ---------------------------------------------------------------------------
-- Expected attendees for a meal request (attendee-scoped preferences)
-- ---------------------------------------------------------------------------
create table if not exists public.meal_request_attendees (
  id uuid primary key default gen_random_uuid(),
  meal_request_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  membership_id uuid not null references public.household_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (meal_request_id, membership_id),
  foreign key (meal_request_id, household_id)
    references public.meal_requests(id, household_id) on delete cascade
);

create index if not exists meal_request_attendees_request_idx
  on public.meal_request_attendees(meal_request_id);

-- ---------------------------------------------------------------------------
-- Guest constraints (meal-scoped only; no permanent guest profiles)
-- ---------------------------------------------------------------------------
create table if not exists public.meal_request_guest_constraints (
  id uuid primary key default gen_random_uuid(),
  meal_request_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  label text not null check (char_length(trim(label)) between 1 and 120),
  created_at timestamptz not null default now(),
  foreign key (meal_request_id, household_id)
    references public.meal_requests(id, household_id) on delete cascade
);

create index if not exists meal_request_guest_constraints_request_idx
  on public.meal_request_guest_constraints(meal_request_id);

-- ---------------------------------------------------------------------------
-- Feedback workflow
-- ---------------------------------------------------------------------------
create table if not exists public.recipe_feedback_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  meal_plan_id uuid not null,
  recipe_id uuid not null,
  membership_id uuid not null references public.household_memberships(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending','responded','dismissed','expired')),
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  dismissed_at timestamptz,
  unique (meal_plan_id, membership_id),
  foreign key (meal_plan_id, household_id)
    references public.meal_plans(id, household_id) on delete cascade,
  foreign key (recipe_id, household_id)
    references public.recipes(id, household_id) on delete cascade
);

create index if not exists recipe_feedback_requests_member_idx
  on public.recipe_feedback_requests(membership_id, status, requested_at desc);

create table if not exists public.recipe_feedback_responses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  feedback_request_id uuid not null unique
    references public.recipe_feedback_requests(id) on delete cascade,
  membership_id uuid not null references public.household_memberships(id) on delete restrict,
  preference_signal text not null
    check (preference_signal in (
      'favorite','would_make_again','okay','would_not_choose_again','have_not_tried'
    )),
  is_favorite boolean not null default false,
  taste integer check (taste is null or (taste between 1 and 5)),
  ease integer check (ease is null or (ease between 1 and 5)),
  cost integer check (cost is null or (cost between 1 and 5)),
  meal_prep_usefulness integer
    check (meal_prep_usefulness is null or (meal_prep_usefulness between 1 and 5)),
  guest_friendliness integer
    check (guest_friendliness is null or (guest_friendliness between 1 and 5)),
  private_note text check (private_note is null or char_length(private_note) <= 500),
  share_identity_with_organizer boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists recipe_feedback_responses_member_idx
  on public.recipe_feedback_responses(membership_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Recommendation runs (durable, versioned)
-- ---------------------------------------------------------------------------
create table if not exists public.recipe_recommendation_runs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  meal_request_id uuid not null,
  requested_by_membership_id uuid not null
    references public.household_memberships(id) on delete restrict,
  ranking_mode text not null
    check (ranking_mode in (
      'best_overall','use_what_we_have','use_food_soon','household_favorite',
      'fastest','fewest_missing_items','meal_prep_friendly','guest_friendly',
      'something_different'
    )),
  scoring_version text not null default '1',
  preference_scope text not null default 'attendees'
    check (preference_scope in ('attendees','household')),
  candidate_count integer not null default 0 check (candidate_count >= 0),
  input_snapshot_hash text not null default '',
  status text not null default 'completed'
    check (status in ('running','completed','failed','superseded')),
  created_at timestamptz not null default now(),
  unique (id, household_id),
  foreign key (meal_request_id, household_id)
    references public.meal_requests(id, household_id) on delete cascade
);

create index if not exists recipe_recommendation_runs_request_idx
  on public.recipe_recommendation_runs(meal_request_id, created_at desc);

alter table public.meal_requests
  drop constraint if exists meal_requests_last_recommendation_run_id_fkey;
alter table public.meal_requests
  add constraint meal_requests_last_recommendation_run_id_fkey
  foreign key (last_recommendation_run_id, household_id)
  references public.recipe_recommendation_runs(id, household_id)
  on delete set null;

create table if not exists public.recipe_recommendation_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  household_id uuid not null references public.households(id) on delete restrict,
  recipe_id uuid not null,
  rank_position integer check (rank_position is null or rank_position >= 1),
  total_score numeric(12,2) not null default 0,
  explanation jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  hard_exclusion_reason text,
  pantry_coverage_summary jsonb not null default '{}'::jsonb,
  preference_fit_summary text not null default 'unknown'
    check (preference_fit_summary in (
      'strong','positive','neutral','mixed','negative','conflict','unknown'
    )),
  missing_required integer not null default 0,
  excluded boolean not null default false,
  created_at timestamptz not null default now(),
  unique (run_id, recipe_id),
  foreign key (run_id, household_id)
    references public.recipe_recommendation_runs(id, household_id) on delete cascade,
  foreign key (recipe_id, household_id)
    references public.recipes(id, household_id) on delete cascade
);

create index if not exists recipe_recommendation_results_run_idx
  on public.recipe_recommendation_results(run_id, rank_position);

create table if not exists public.recipe_recommendation_score_components (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.recipe_recommendation_results(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete restrict,
  component_key text not null
    check (component_key in (
      'pantry_coverage','use_soon_utilization','missing_required_count',
      'missing_optional_count','unit_uncertainty','attendee_preference',
      'strong_dislike_penalty','favorite_bonus','time_fit','meal_type_fit',
      'equipment_fit','serving_scalability','meal_prep_fit','guest_fit',
      'recently_prepared_penalty','category_repetition_penalty',
      'shopping_cost_estimate','novelty_bonus'
    )),
  value numeric(12,4) not null default 0,
  weight numeric(12,4) not null default 0,
  contribution numeric(12,4) not null default 0,
  created_at timestamptz not null default now(),
  unique (result_id, component_key)
);

create index if not exists recipe_recommendation_score_components_result_idx
  on public.recipe_recommendation_score_components(result_id);

-- Extend meal_request_results for richer payloads (compat)
alter table public.meal_request_results
  add column if not exists warnings jsonb not null default '[]'::jsonb,
  add column if not exists preference_fit_summary text not null default 'unknown',
  add column if not exists recommendation_run_id uuid,
  add column if not exists pantry_coverage_ratio numeric(8,4);

-- ---------------------------------------------------------------------------
-- Recipe prep history rollup (household-level signals; not like/dislike)
-- ---------------------------------------------------------------------------
create table if not exists public.recipe_prep_history (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  recipe_id uuid not null,
  times_prepared integer not null default 0 check (times_prepared >= 0),
  last_prepared_at timestamptz,
  last_meal_type text,
  last_used_for_meal_prep boolean not null default false,
  last_shopping_requirement_high boolean not null default false,
  last_preparation_cancelled boolean not null default false,
  last_leftover_approximate boolean not null default false,
  last_successful_for_guests boolean,
  last_consumed_use_soon boolean not null default false,
  recent_category_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recipe_id, household_id),
  foreign key (recipe_id, household_id)
    references public.recipes(id, household_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- RPC-only triggers for new tables
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'meal_request_attendees',
    'meal_request_guest_constraints',
    'recipe_feedback_requests',
    'recipe_feedback_responses',
    'recipe_recommendation_runs',
    'recipe_recommendation_results',
    'recipe_recommendation_score_components',
    'recipe_prep_history'
  ]
  loop
    execute format(
      'drop trigger if exists %I_rpc_only on public.%I',
      t, t
    );
    execute format(
      'create trigger %I_rpc_only before insert or update or delete on public.%I
       for each row execute function public.enforce_meal_rpc_only()',
      t, t
    );
  end loop;
end $$;

create trigger recipe_prep_history_set_updated_at
  before update on public.recipe_prep_history
  for each row execute function public.set_updated_at();
