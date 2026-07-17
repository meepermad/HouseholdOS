-- Phase 6.5: meal domain RLS

alter table public.household_meal_settings enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_visibility_members enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_steps enable row level security;
alter table public.recipe_equipment enable row level security;
alter table public.recipe_ingredient_aliases enable row level security;
alter table public.recipe_user_preferences enable row level security;
alter table public.member_dietary_preferences enable row level security;
alter table public.meal_requests enable row level security;
alter table public.meal_request_constraints enable row level security;
alter table public.meal_request_results enable row level security;
alter table public.meal_plans enable row level security;
alter table public.meal_attendees enable row level security;
alter table public.meal_plan_ingredients enable row level security;
alter table public.meal_plan_assignments enable row level security;
alter table public.meal_plan_chore_links enable row level security;
alter table public.meal_plan_expense_links enable row level security;
alter table public.meal_shopping_proposals enable row level security;
alter table public.meal_shopping_proposal_lines enable row level security;
alter table public.meal_prep_batches enable row level security;
alter table public.meal_batch_stock_events enable row level security;

create or replace function public._meal_active_membership(p_household_id uuid)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select m.id into v_id from public.household_memberships m
  where m.household_id = p_household_id and m.user_id = auth.uid() and m.status = 'active';
  if v_id is null then raise exception 'Active membership required for this household'; end if;
  return v_id;
end $$;
revoke all on function public._meal_active_membership(uuid) from public, anon;

-- Coordinators must NOT bypass creator_only recipes.
create or replace function public.can_view_recipe(p_recipe_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.recipes r
    where r.id = p_recipe_id
      and r.archived_at is null
      and public.is_active_member(r.household_id)
      and (
        r.visibility = 'household'
        or (
          r.visibility = 'creator_only'
          and r.created_by_membership_id = public.current_membership_id(r.household_id)
        )
        or (
          r.visibility = 'selected_members'
          and (
            r.created_by_membership_id = public.current_membership_id(r.household_id)
            or exists (
              select 1 from public.recipe_visibility_members vm
              where vm.recipe_id = r.id
                and vm.membership_id = public.current_membership_id(r.household_id)
            )
          )
        )
      )
  )
$$;
revoke all on function public.can_view_recipe(uuid) from public, anon;
grant execute on function public.can_view_recipe(uuid) to authenticated;

create or replace function public.can_view_meal_plan(p_meal_plan_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.meal_plans mp
    where mp.id = p_meal_plan_id
      and public.is_active_member(mp.household_id)
      and (
        mp.visibility = 'household'
        or mp.organizer_membership_id = public.current_membership_id(mp.household_id)
        or mp.created_by_membership_id = public.current_membership_id(mp.household_id)
        or (
          mp.visibility = 'participants'
          and exists (
            select 1 from public.meal_attendees a
            where a.meal_plan_id = mp.id
              and a.membership_id = public.current_membership_id(mp.household_id)
          )
        )
        or (
          mp.visibility = 'creator_only'
          and mp.created_by_membership_id = public.current_membership_id(mp.household_id)
        )
      )
  )
$$;
revoke all on function public.can_view_meal_plan(uuid) from public, anon;
grant execute on function public.can_view_meal_plan(uuid) to authenticated;

create or replace function public.can_view_meal_batch(p_batch_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.meal_prep_batches b
    where b.id = p_batch_id
      and public.is_active_member(b.household_id)
      and (
        b.availability in ('household','open_household')
        or b.prepared_by_membership_id = public.current_membership_id(b.household_id)
        or (
          b.availability = 'personal'
          and b.owner_membership_id = public.current_membership_id(b.household_id)
        )
      )
  )
$$;
revoke all on function public.can_view_meal_batch(uuid) from public, anon;
grant execute on function public.can_view_meal_batch(uuid) to authenticated;

-- Settings: active members read; coordinators write via RPC
create policy household_meal_settings_select on public.household_meal_settings
  for select to authenticated using (public.is_active_member(household_id));

-- Recipes
create policy recipes_select on public.recipes
  for select to authenticated using (public.can_view_recipe(id));

create policy recipe_visibility_members_select on public.recipe_visibility_members
  for select to authenticated using (public.can_view_recipe(recipe_id));

create policy recipe_ingredients_select on public.recipe_ingredients
  for select to authenticated using (public.can_view_recipe(recipe_id));

create policy recipe_steps_select on public.recipe_steps
  for select to authenticated using (public.can_view_recipe(recipe_id));

create policy recipe_equipment_select on public.recipe_equipment
  for select to authenticated using (public.can_view_recipe(recipe_id));

create policy recipe_aliases_select on public.recipe_ingredient_aliases
  for select to authenticated using (
    household_id is null or public.is_active_member(household_id)
  );

create policy recipe_user_preferences_select on public.recipe_user_preferences
  for select to authenticated using (
    public.is_active_member(household_id)
    and (
      membership_id = public.current_membership_id(household_id)
      or public.can_view_recipe(recipe_id)
    )
  );

-- Dietary: owner only
create policy member_dietary_preferences_select on public.member_dietary_preferences
  for select to authenticated using (
    membership_id = public.current_membership_id(household_id)
  );

-- Meal requests: active members of household
create policy meal_requests_select on public.meal_requests
  for select to authenticated using (public.is_active_member(household_id));

create policy meal_request_constraints_select on public.meal_request_constraints
  for select to authenticated using (public.is_active_member(household_id));

create policy meal_request_results_select on public.meal_request_results
  for select to authenticated using (
    public.is_active_member(household_id) and public.can_view_recipe(recipe_id)
  );

-- Meal plans
create policy meal_plans_select on public.meal_plans
  for select to authenticated using (public.can_view_meal_plan(id));

create policy meal_attendees_select on public.meal_attendees
  for select to authenticated using (public.can_view_meal_plan(meal_plan_id));

create policy meal_plan_ingredients_select on public.meal_plan_ingredients
  for select to authenticated using (public.can_view_meal_plan(meal_plan_id));

create policy meal_plan_assignments_select on public.meal_plan_assignments
  for select to authenticated using (public.can_view_meal_plan(meal_plan_id));

create policy meal_plan_chore_links_select on public.meal_plan_chore_links
  for select to authenticated using (public.can_view_meal_plan(meal_plan_id));

create policy meal_plan_expense_links_select on public.meal_plan_expense_links
  for select to authenticated using (public.can_view_meal_plan(meal_plan_id));

create policy meal_shopping_proposals_select on public.meal_shopping_proposals
  for select to authenticated using (public.can_view_meal_plan(meal_plan_id));

create policy meal_shopping_proposal_lines_select on public.meal_shopping_proposal_lines
  for select to authenticated using (
    exists (
      select 1 from public.meal_shopping_proposals p
      where p.id = proposal_id and public.can_view_meal_plan(p.meal_plan_id)
    )
  );

create policy meal_prep_batches_select on public.meal_prep_batches
  for select to authenticated using (public.can_view_meal_batch(id));

create policy meal_batch_stock_events_select on public.meal_batch_stock_events
  for select to authenticated using (public.can_view_meal_batch(batch_id));
