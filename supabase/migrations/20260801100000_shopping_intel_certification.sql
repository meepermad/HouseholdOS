-- Shopping Intelligence certification: rediscovery ingredient proposals,
-- staple suppressions, forecast prefs.

-- ---------------------------------------------------------------------------
-- Prefs extensions
-- ---------------------------------------------------------------------------
alter table public.shopping_recommendation_preferences
  add column if not exists min_staple_purchase_count integer not null default 3
    check (min_staple_purchase_count between 2 and 20);

alter table public.shopping_recommendation_preferences
  add column if not exists forecast_formula_version text not null default '1';

-- ---------------------------------------------------------------------------
-- Per-item staple suppression (household-scoped)
-- ---------------------------------------------------------------------------
create table if not exists public.shopping_staple_suppressions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  normalized_key text not null check (char_length(trim(normalized_key)) between 1 and 200),
  related_supply_id uuid,
  suppressed_by_membership_id uuid not null references public.household_memberships(id) on delete cascade,
  reason text not null default 'do_not_recommend'
    check (reason in ('do_not_recommend', 'no_longer_use')),
  created_at timestamptz not null default now(),
  unique (household_id, normalized_key),
  foreign key (related_supply_id, household_id)
    references public.supply_items(id, household_id) on delete set null
);

create index if not exists shopping_staple_suppressions_hh_idx
  on public.shopping_staple_suppressions(household_id);

alter table public.shopping_staple_suppressions enable row level security;

drop policy if exists shopping_staple_suppressions_select on public.shopping_staple_suppressions;
create policy shopping_staple_suppressions_select
  on public.shopping_staple_suppressions for select to authenticated
  using (public.is_active_member(household_id));

drop policy if exists shopping_staple_suppressions_write_deny on public.shopping_staple_suppressions;
create policy shopping_staple_suppressions_write_deny
  on public.shopping_staple_suppressions for all to authenticated
  using (false) with check (false);

-- ---------------------------------------------------------------------------
-- Rediscovery ingredient shopping proposals (review-first)
-- ---------------------------------------------------------------------------
-- Ensure suggestions have composite unique for FK before proposals table
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'recipe_rediscovery_suggestions_id_hh_key'
  ) then
    alter table public.recipe_rediscovery_suggestions
      add constraint recipe_rediscovery_suggestions_id_hh_key unique (id, household_id);
  end if;
exception when duplicate_object then null;
end $$;

create table if not exists public.recipe_rediscovery_ingredient_proposals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  suggestion_id uuid not null,
  recipe_id uuid not null,
  list_id uuid,
  status text not null default 'draft'
    check (status in ('draft', 'confirmed', 'cancelled', 'expired')),
  scoring_version text not null default '1',
  policy_note text not null default 'review_first',
  built_by_membership_id uuid not null references public.household_memberships(id) on delete cascade,
  client_idempotency_key text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '2 hours'),
  unique (household_id, client_idempotency_key),
  unique (id, household_id),
  foreign key (suggestion_id, household_id)
    references public.recipe_rediscovery_suggestions(id, household_id) on delete cascade,
  foreign key (list_id, household_id)
    references public.shopping_lists(id, household_id) on delete set null
);

create index if not exists recipe_rediscovery_ingredient_proposals_sug_idx
  on public.recipe_rediscovery_ingredient_proposals(suggestion_id, created_at desc);

create table if not exists public.recipe_rediscovery_ingredient_proposal_lines (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.recipe_rediscovery_ingredient_proposals(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  recipe_ingredient_id uuid,
  display_name text not null,
  required boolean not null default true,
  required_quantity numeric(12,3),
  shortfall_quantity numeric(12,3),
  quantity_unit text not null default 'item',
  line_status text not null,
  unit_mismatch boolean not null default false,
  excluded boolean not null default false,
  already_on_list boolean not null default false,
  existing_list_item_id uuid,
  shopping_list_item_id uuid,
  sort_order integer not null default 0,
  foreign key (proposal_id, household_id)
    references public.recipe_rediscovery_ingredient_proposals(id, household_id) on delete cascade
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'recipe_rediscovery_ingredient_proposals_id_hh_key'
  ) then
    alter table public.recipe_rediscovery_ingredient_proposals
      add constraint recipe_rediscovery_ingredient_proposals_id_hh_key unique (id, household_id);
  end if;
exception when duplicate_object then null;
end $$;

create table if not exists public.recipe_rediscovery_shopping_item_links (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  suggestion_id uuid not null,
  proposal_id uuid not null,
  proposal_line_id uuid not null,
  shopping_item_id uuid not null,
  created_at timestamptz not null default now(),
  unique (proposal_line_id),
  foreign key (suggestion_id, household_id)
    references public.recipe_rediscovery_suggestions(id, household_id) on delete cascade,
  foreign key (proposal_id, household_id)
    references public.recipe_rediscovery_ingredient_proposals(id, household_id) on delete cascade
);

alter table public.recipe_rediscovery_ingredient_proposals enable row level security;
alter table public.recipe_rediscovery_ingredient_proposal_lines enable row level security;
alter table public.recipe_rediscovery_shopping_item_links enable row level security;

drop policy if exists rediscovery_ingredient_proposals_select on public.recipe_rediscovery_ingredient_proposals;
create policy rediscovery_ingredient_proposals_select
  on public.recipe_rediscovery_ingredient_proposals for select to authenticated
  using (public.is_active_member(household_id));

drop policy if exists rediscovery_ingredient_proposals_write_deny on public.recipe_rediscovery_ingredient_proposals;
create policy rediscovery_ingredient_proposals_write_deny
  on public.recipe_rediscovery_ingredient_proposals for all to authenticated
  using (false) with check (false);

drop policy if exists rediscovery_ingredient_lines_select on public.recipe_rediscovery_ingredient_proposal_lines;
create policy rediscovery_ingredient_lines_select
  on public.recipe_rediscovery_ingredient_proposal_lines for select to authenticated
  using (public.is_active_member(household_id));

drop policy if exists rediscovery_ingredient_lines_write_deny on public.recipe_rediscovery_ingredient_proposal_lines;
create policy rediscovery_ingredient_lines_write_deny
  on public.recipe_rediscovery_ingredient_proposal_lines for all to authenticated
  using (false) with check (false);

drop policy if exists rediscovery_shopping_links_select on public.recipe_rediscovery_shopping_item_links;
create policy rediscovery_shopping_links_select
  on public.recipe_rediscovery_shopping_item_links for select to authenticated
  using (public.is_active_member(household_id));

drop policy if exists rediscovery_shopping_links_write_deny on public.recipe_rediscovery_shopping_item_links;
create policy rediscovery_shopping_links_write_deny
  on public.recipe_rediscovery_shopping_item_links for all to authenticated
  using (false) with check (false);
