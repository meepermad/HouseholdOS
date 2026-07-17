-- Phase 7A: RLS for preference-aware recommendation tables

alter table public.meal_request_attendees enable row level security;
alter table public.meal_request_guest_constraints enable row level security;
alter table public.recipe_feedback_requests enable row level security;
alter table public.recipe_feedback_responses enable row level security;
alter table public.recipe_recommendation_runs enable row level security;
alter table public.recipe_recommendation_results enable row level security;
alter table public.recipe_recommendation_score_components enable row level security;
alter table public.recipe_prep_history enable row level security;

-- Tighten preference select: own rows only for private fields; others cannot read private_note
drop policy if exists recipe_user_preferences_select on public.recipe_user_preferences;
create policy recipe_user_preferences_select on public.recipe_user_preferences
  for select to authenticated using (
    public.is_active_member(household_id)
    and membership_id = public.current_membership_id(household_id)
  );

-- Attendees / guest constraints: household members who can see the request
create policy meal_request_attendees_select on public.meal_request_attendees
  for select to authenticated using (public.is_active_member(household_id));

create policy meal_request_guest_constraints_select on public.meal_request_guest_constraints
  for select to authenticated using (public.is_active_member(household_id));

-- Feedback requests: target member only (or meal organizer may see existence without response body)
create policy recipe_feedback_requests_select on public.recipe_feedback_requests
  for select to authenticated using (
    public.is_active_member(household_id)
    and (
      membership_id = public.current_membership_id(household_id)
      or exists (
        select 1 from public.meal_plans mp
        where mp.id = meal_plan_id
          and mp.organizer_membership_id = public.current_membership_id(household_id)
      )
    )
  );

-- Feedback responses: owner only (private ratings)
create policy recipe_feedback_responses_select on public.recipe_feedback_responses
  for select to authenticated using (
    membership_id = public.current_membership_id(household_id)
  );

-- Recommendation runs/results: household members; recipe visibility still applies on results
create policy recipe_recommendation_runs_select on public.recipe_recommendation_runs
  for select to authenticated using (public.is_active_member(household_id));

create policy recipe_recommendation_results_select on public.recipe_recommendation_results
  for select to authenticated using (
    public.is_active_member(household_id) and public.can_view_recipe(recipe_id)
  );

create policy recipe_recommendation_score_components_select on public.recipe_recommendation_score_components
  for select to authenticated using (
    public.is_active_member(household_id)
    and exists (
      select 1 from public.recipe_recommendation_results r
      where r.id = result_id and public.can_view_recipe(r.recipe_id)
    )
  );

create policy recipe_prep_history_select on public.recipe_prep_history
  for select to authenticated using (
    public.is_active_member(household_id) and public.can_view_recipe(recipe_id)
  );

revoke all on table public.meal_request_attendees from public;
revoke all on table public.meal_request_guest_constraints from public;
revoke all on table public.recipe_feedback_requests from public;
revoke all on table public.recipe_feedback_responses from public;
revoke all on table public.recipe_recommendation_runs from public;
revoke all on table public.recipe_recommendation_results from public;
revoke all on table public.recipe_recommendation_score_components from public;
revoke all on table public.recipe_prep_history from public;

grant select on table public.meal_request_attendees to authenticated;
grant select on table public.meal_request_guest_constraints to authenticated;
grant select on table public.recipe_feedback_requests to authenticated;
grant select on table public.recipe_feedback_responses to authenticated;
grant select on table public.recipe_recommendation_runs to authenticated;
grant select on table public.recipe_recommendation_results to authenticated;
grant select on table public.recipe_recommendation_score_components to authenticated;
grant select on table public.recipe_prep_history to authenticated;

grant all on table public.meal_request_attendees to service_role;
grant all on table public.meal_request_guest_constraints to service_role;
grant all on table public.recipe_feedback_requests to service_role;
grant all on table public.recipe_feedback_responses to service_role;
grant all on table public.recipe_recommendation_runs to service_role;
grant all on table public.recipe_recommendation_results to service_role;
grant all on table public.recipe_recommendation_score_components to service_role;
grant all on table public.recipe_prep_history to service_role;
