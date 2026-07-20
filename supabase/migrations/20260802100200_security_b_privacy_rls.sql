-- Security-B2/B3/B4/B7: export job visibility, OB children, shopping-intel children, roommate write tighten

-- ---------------------------------------------------------------------------
-- B2: export jobs visible to requester + household coordinators only
-- ---------------------------------------------------------------------------
drop policy if exists household_export_jobs_select on public.household_export_jobs;
create policy household_export_jobs_select
  on public.household_export_jobs for select to authenticated
  using (
    public.is_active_member(household_id)
    and (
      requested_by_membership_id = public.current_membership_id(household_id)
      or public.is_household_coordinator(household_id)
    )
  );

-- ---------------------------------------------------------------------------
-- B3: opening-balance children inherit parent visibility
-- ---------------------------------------------------------------------------
create or replace function public.can_view_opening_balance_entry(p_entry_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.opening_balance_entries e
    where e.id = p_entry_id
      and public.is_active_member(e.household_id)
      and (
        e.debtor_membership_id = public.current_membership_id(e.household_id)
        or e.creditor_membership_id = public.current_membership_id(e.household_id)
        or e.created_by_membership_id = public.current_membership_id(e.household_id)
        or public._is_financial_coordinator(e.household_id)
      )
  );
$$;

create or replace function public.can_participate_in_opening_balance(p_entry_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.opening_balance_entries e
    where e.id = p_entry_id
      and public.is_active_member(e.household_id)
      and (
        e.debtor_membership_id = public.current_membership_id(e.household_id)
        or e.creditor_membership_id = public.current_membership_id(e.household_id)
      )
  );
$$;

revoke all on function public.can_view_opening_balance_entry(uuid) from public;
revoke all on function public.can_participate_in_opening_balance(uuid) from public;
grant execute on function public.can_view_opening_balance_entry(uuid) to authenticated;
grant execute on function public.can_participate_in_opening_balance(uuid) to authenticated;

drop policy if exists opening_balance_approvals_select on public.opening_balance_approvals;
create policy opening_balance_approvals_select on public.opening_balance_approvals
  for select to authenticated
  using (public.can_view_opening_balance_entry(entry_id));

drop policy if exists opening_balance_events_select on public.opening_balance_events;
create policy opening_balance_events_select on public.opening_balance_events
  for select to authenticated
  using (public.can_view_opening_balance_entry(entry_id));

drop policy if exists opening_balance_import_links_select on public.opening_balance_import_links;
create policy opening_balance_import_links_select on public.opening_balance_import_links
  for select to authenticated
  using (public.can_view_opening_balance_entry(entry_id));

-- ---------------------------------------------------------------------------
-- B4: shopping-intel children inherit parent item / suggestion visibility
-- ---------------------------------------------------------------------------
create or replace function public.can_view_shopping_recommendation_item(p_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.shopping_recommendation_items i
    where i.id = p_item_id
      and public.is_active_member(i.household_id)
      and (
        i.visibility = 'shared'
        or i.owner_membership_id is null
        or i.owner_membership_id = public.current_membership_id(i.household_id)
      )
  );
$$;

create or replace function public.can_view_recipe_rediscovery_suggestion(p_suggestion_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.recipe_rediscovery_suggestions s
    where s.id = p_suggestion_id
      and public.is_active_member(s.household_id)
      and s.viewer_membership_id = public.current_membership_id(s.household_id)
  );
$$;

revoke all on function public.can_view_shopping_recommendation_item(uuid) from public;
revoke all on function public.can_view_recipe_rediscovery_suggestion(uuid) from public;
grant execute on function public.can_view_shopping_recommendation_item(uuid) to authenticated;
grant execute on function public.can_view_recipe_rediscovery_suggestion(uuid) to authenticated;

drop policy if exists shopping_rec_sources_select on public.shopping_recommendation_sources;
create policy shopping_rec_sources_select on public.shopping_recommendation_sources
  for select to authenticated
  using (public.can_view_shopping_recommendation_item(item_id));

drop policy if exists shopping_rec_decisions_select on public.shopping_recommendation_decisions;
create policy shopping_rec_decisions_select on public.shopping_recommendation_decisions
  for select to authenticated
  using (public.can_view_shopping_recommendation_item(item_id));

drop policy if exists shopping_trip_events_select on public.shopping_trip_events;
create policy shopping_trip_events_select on public.shopping_trip_events
  for select to authenticated
  using (
    public.is_active_member(household_id)
    and exists (
      select 1 from public.shopping_trip_sessions s
      where s.id = trip_id
        and (
          s.started_by_membership_id = public.current_membership_id(household_id)
          or public.is_household_coordinator(household_id)
          or actor_membership_id = public.current_membership_id(household_id)
        )
    )
  );

drop policy if exists recipe_suggestion_snoozes_select on public.recipe_suggestion_snoozes;
create policy recipe_suggestion_snoozes_select on public.recipe_suggestion_snoozes
  for select to authenticated
  using (
    public.is_active_member(household_id)
    and membership_id = public.current_membership_id(household_id)
  );

drop policy if exists recipe_rediscovery_suggestions_select on public.recipe_rediscovery_suggestions;
create policy recipe_rediscovery_suggestions_select
  on public.recipe_rediscovery_suggestions for select to authenticated
  using (
    public.is_active_member(household_id)
    and viewer_membership_id = public.current_membership_id(household_id)
  );

drop policy if exists recipe_rediscovery_decisions_select on public.recipe_rediscovery_decisions;
create policy recipe_rediscovery_decisions_select on public.recipe_rediscovery_decisions
  for select to authenticated
  using (
    public.is_active_member(household_id)
    and (
      actor_membership_id = public.current_membership_id(household_id)
      or public.can_view_recipe_rediscovery_suggestion(suggestion_id)
    )
  );

drop policy if exists rediscovery_ingredient_proposals_select on public.recipe_rediscovery_ingredient_proposals;
create policy rediscovery_ingredient_proposals_select
  on public.recipe_rediscovery_ingredient_proposals for select to authenticated
  using (
    public.is_active_member(household_id)
    and (
      built_by_membership_id = public.current_membership_id(household_id)
      or public.can_view_recipe_rediscovery_suggestion(suggestion_id)
    )
  );

drop policy if exists rediscovery_ingredient_lines_select on public.recipe_rediscovery_ingredient_proposal_lines;
create policy rediscovery_ingredient_lines_select
  on public.recipe_rediscovery_ingredient_proposal_lines for select to authenticated
  using (
    exists (
      select 1 from public.recipe_rediscovery_ingredient_proposals p
      where p.id = proposal_id
        and public.is_active_member(p.household_id)
        and (
          p.built_by_membership_id = public.current_membership_id(p.household_id)
          or public.can_view_recipe_rediscovery_suggestion(p.suggestion_id)
        )
    )
  );

drop policy if exists rediscovery_shopping_links_select on public.recipe_rediscovery_shopping_item_links;
create policy rediscovery_shopping_links_select
  on public.recipe_rediscovery_shopping_item_links for select to authenticated
  using (
    exists (
      select 1 from public.recipe_rediscovery_ingredient_proposals p
      where p.id = proposal_id
        and public.is_active_member(p.household_id)
        and (
          p.built_by_membership_id = public.current_membership_id(p.household_id)
          or public.can_view_recipe_rediscovery_suggestion(p.suggestion_id)
        )
    )
  );

drop policy if exists shopping_staple_suppressions_select on public.shopping_staple_suppressions;
create policy shopping_staple_suppressions_select
  on public.shopping_staple_suppressions for select to authenticated
  using (
    public.is_active_member(household_id)
    and suppressed_by_membership_id = public.current_membership_id(household_id)
  );

-- ---------------------------------------------------------------------------
-- B7: roommate ops — tighten update policies (beta modules)
-- ---------------------------------------------------------------------------
drop policy if exists shared_purchase_proposals_update on public.shared_purchase_proposals;
create policy shared_purchase_proposals_update on public.shared_purchase_proposals
  for update to authenticated
  using (
    public.is_active_member(household_id)
    and (
      created_by_membership_id = public.current_membership_id(household_id)
      or public.is_household_coordinator(household_id)
    )
  )
  with check (
    public.is_active_member(household_id)
    and (
      created_by_membership_id = public.current_membership_id(household_id)
      or public.is_household_coordinator(household_id)
    )
  );

drop policy if exists household_meeting_notes_update on public.household_meeting_notes;
create policy household_meeting_notes_update on public.household_meeting_notes
  for update to authenticated
  using (
    public.is_active_member(household_id)
    and (
      created_by_membership_id = public.current_membership_id(household_id)
      or public.is_household_coordinator(household_id)
    )
  )
  with check (
    public.is_active_member(household_id)
    and (
      created_by_membership_id = public.current_membership_id(household_id)
      or public.is_household_coordinator(household_id)
    )
  );

drop policy if exists household_packages_select on public.household_packages;
create policy household_packages_select on public.household_packages
  for select to authenticated
  using (
    public.is_active_member(household_id)
    and (
      recipient_membership_id is null
      or recipient_membership_id = public.current_membership_id(household_id)
      or created_by_membership_id = public.current_membership_id(household_id)
      or public.is_household_coordinator(household_id)
    )
  );

drop policy if exists household_packages_update on public.household_packages;
create policy household_packages_update on public.household_packages
  for update to authenticated
  using (
    public.is_active_member(household_id)
    and (
      recipient_membership_id = public.current_membership_id(household_id)
      or created_by_membership_id = public.current_membership_id(household_id)
      or public.is_household_coordinator(household_id)
    )
  )
  with check (
    public.is_active_member(household_id)
    and (
      recipient_membership_id = public.current_membership_id(household_id)
      or created_by_membership_id = public.current_membership_id(household_id)
      or public.is_household_coordinator(household_id)
    )
  );

drop policy if exists household_directory_contacts_all on public.household_directory_contacts;
create policy household_directory_contacts_select on public.household_directory_contacts
  for select to authenticated using (public.is_active_member(household_id));
create policy household_directory_contacts_write on public.household_directory_contacts
  for all to authenticated
  using (public.is_household_coordinator(household_id))
  with check (public.is_household_coordinator(household_id));

drop policy if exists household_parking_spots_all on public.household_parking_spots;
create policy household_parking_spots_select on public.household_parking_spots
  for select to authenticated using (public.is_active_member(household_id));
create policy household_parking_spots_write on public.household_parking_spots
  for all to authenticated
  using (public.is_household_coordinator(household_id))
  with check (public.is_household_coordinator(household_id));

drop policy if exists household_parking_assignments_all on public.household_parking_assignments;
create policy household_parking_assignments_select on public.household_parking_assignments
  for select to authenticated using (public.is_active_member(household_id));
create policy household_parking_assignments_write on public.household_parking_assignments
  for all to authenticated
  using (
    public.is_active_member(household_id)
    and (
      membership_id = public.current_membership_id(household_id)
      or public.is_household_coordinator(household_id)
    )
  )
  with check (
    public.is_active_member(household_id)
    and (
      membership_id = public.current_membership_id(household_id)
      or public.is_household_coordinator(household_id)
    )
  );
