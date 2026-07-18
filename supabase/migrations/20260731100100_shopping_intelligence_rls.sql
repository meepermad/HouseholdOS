-- Shopping Intelligence RLS

alter table public.shopping_recommendation_preferences enable row level security;
alter table public.recipe_rediscovery_preferences enable row level security;
alter table public.shopping_recommendation_runs enable row level security;
alter table public.shopping_recommendation_items enable row level security;
alter table public.shopping_recommendation_sources enable row level security;
alter table public.shopping_recommendation_decisions enable row level security;
alter table public.shopping_trip_sessions enable row level security;
alter table public.shopping_trip_events enable row level security;
alter table public.recipe_suggestion_snoozes enable row level security;
alter table public.recipe_rediscovery_suggestions enable row level security;
alter table public.recipe_rediscovery_decisions enable row level security;

drop policy if exists shopping_rec_prefs_select on public.shopping_recommendation_preferences;
drop policy if exists recipe_rediscovery_prefs_select on public.recipe_rediscovery_preferences;
drop policy if exists shopping_rec_runs_select on public.shopping_recommendation_runs;
drop policy if exists shopping_rec_items_select on public.shopping_recommendation_items;
drop policy if exists shopping_rec_sources_select on public.shopping_recommendation_sources;
drop policy if exists shopping_rec_decisions_select on public.shopping_recommendation_decisions;
drop policy if exists shopping_trip_sessions_select on public.shopping_trip_sessions;
drop policy if exists shopping_trip_events_select on public.shopping_trip_events;
drop policy if exists recipe_suggestion_snoozes_select on public.recipe_suggestion_snoozes;
drop policy if exists recipe_rediscovery_suggestions_select on public.recipe_rediscovery_suggestions;
drop policy if exists recipe_rediscovery_decisions_select on public.recipe_rediscovery_decisions;

create policy shopping_rec_prefs_select on public.shopping_recommendation_preferences
  for select to authenticated using (public.is_active_member(household_id));
create policy recipe_rediscovery_prefs_select on public.recipe_rediscovery_preferences
  for select to authenticated using (public.is_active_member(household_id));
create policy shopping_rec_runs_select on public.shopping_recommendation_runs
  for select to authenticated using (public.is_active_member(household_id));
create policy shopping_rec_items_select on public.shopping_recommendation_items
  for select to authenticated using (
    public.is_active_member(household_id)
    and (
      visibility = 'shared'
      or owner_membership_id is null
      or owner_membership_id = public.current_membership_id(household_id)
    )
  );
create policy shopping_rec_sources_select on public.shopping_recommendation_sources
  for select to authenticated using (public.is_active_member(household_id));
create policy shopping_rec_decisions_select on public.shopping_recommendation_decisions
  for select to authenticated using (public.is_active_member(household_id));
create policy shopping_trip_sessions_select on public.shopping_trip_sessions
  for select to authenticated using (public.is_active_member(household_id));
create policy shopping_trip_events_select on public.shopping_trip_events
  for select to authenticated using (public.is_active_member(household_id));
create policy recipe_suggestion_snoozes_select on public.recipe_suggestion_snoozes
  for select to authenticated using (public.is_active_member(household_id));
create policy recipe_rediscovery_suggestions_select on public.recipe_rediscovery_suggestions
  for select to authenticated using (public.is_active_member(household_id));
create policy recipe_rediscovery_decisions_select on public.recipe_rediscovery_decisions
  for select to authenticated using (public.is_active_member(household_id));

drop policy if exists shopping_rec_prefs_no_write on public.shopping_recommendation_preferences;
drop policy if exists recipe_rediscovery_prefs_no_write on public.recipe_rediscovery_preferences;
drop policy if exists shopping_rec_runs_no_write on public.shopping_recommendation_runs;
drop policy if exists shopping_rec_items_no_write on public.shopping_recommendation_items;
drop policy if exists shopping_rec_sources_no_write on public.shopping_recommendation_sources;
drop policy if exists shopping_rec_decisions_no_write on public.shopping_recommendation_decisions;
drop policy if exists shopping_trip_sessions_no_write on public.shopping_trip_sessions;
drop policy if exists shopping_trip_events_no_write on public.shopping_trip_events;
drop policy if exists recipe_suggestion_snoozes_no_write on public.recipe_suggestion_snoozes;
drop policy if exists recipe_rediscovery_suggestions_no_write on public.recipe_rediscovery_suggestions;
drop policy if exists recipe_rediscovery_decisions_no_write on public.recipe_rediscovery_decisions;

create policy shopping_rec_prefs_no_write on public.shopping_recommendation_preferences
  for all to authenticated using (false) with check (false);
create policy recipe_rediscovery_prefs_no_write on public.recipe_rediscovery_preferences
  for all to authenticated using (false) with check (false);
create policy shopping_rec_runs_no_write on public.shopping_recommendation_runs
  for all to authenticated using (false) with check (false);
create policy shopping_rec_items_no_write on public.shopping_recommendation_items
  for all to authenticated using (false) with check (false);
create policy shopping_rec_sources_no_write on public.shopping_recommendation_sources
  for all to authenticated using (false) with check (false);
create policy shopping_rec_decisions_no_write on public.shopping_recommendation_decisions
  for all to authenticated using (false) with check (false);
create policy shopping_trip_sessions_no_write on public.shopping_trip_sessions
  for all to authenticated using (false) with check (false);
create policy shopping_trip_events_no_write on public.shopping_trip_events
  for all to authenticated using (false) with check (false);
create policy recipe_suggestion_snoozes_no_write on public.recipe_suggestion_snoozes
  for all to authenticated using (false) with check (false);
create policy recipe_rediscovery_suggestions_no_write on public.recipe_rediscovery_suggestions
  for all to authenticated using (false) with check (false);
create policy recipe_rediscovery_decisions_no_write on public.recipe_rediscovery_decisions
  for all to authenticated using (false) with check (false);

grant select on public.shopping_recommendation_preferences to authenticated;
grant select on public.recipe_rediscovery_preferences to authenticated;
grant select on public.shopping_recommendation_runs to authenticated;
grant select on public.shopping_recommendation_items to authenticated;
grant select on public.shopping_recommendation_sources to authenticated;
grant select on public.shopping_recommendation_decisions to authenticated;
grant select on public.shopping_trip_sessions to authenticated;
grant select on public.shopping_trip_events to authenticated;
grant select on public.recipe_suggestion_snoozes to authenticated;
grant select on public.recipe_rediscovery_suggestions to authenticated;
grant select on public.recipe_rediscovery_decisions to authenticated;
