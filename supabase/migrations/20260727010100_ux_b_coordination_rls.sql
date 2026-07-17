-- UX-B RLS using existing membership helpers where available.

-- Away status
drop policy if exists membership_away_status_select on public.membership_away_status;
create policy membership_away_status_select on public.membership_away_status
  for select to authenticated
  using (public.is_active_member(household_id));

drop policy if exists membership_away_status_insert on public.membership_away_status;
create policy membership_away_status_insert on public.membership_away_status
  for insert to authenticated
  with check (
    membership_id = public.current_membership_id(household_id)
    and public.is_active_member(household_id)
  );

drop policy if exists membership_away_status_update on public.membership_away_status;
create policy membership_away_status_update on public.membership_away_status
  for update to authenticated
  using (membership_id = public.current_membership_id(household_id))
  with check (membership_id = public.current_membership_id(household_id));

drop policy if exists membership_away_status_delete on public.membership_away_status;
create policy membership_away_status_delete on public.membership_away_status
  for delete to authenticated
  using (membership_id = public.current_membership_id(household_id));

-- Guest notices
drop policy if exists guest_notices_select on public.guest_notices;
create policy guest_notices_select on public.guest_notices
  for select to authenticated
  using (public.is_active_member(household_id));

drop policy if exists guest_notices_insert on public.guest_notices;
create policy guest_notices_insert on public.guest_notices
  for insert to authenticated
  with check (
    host_membership_id = public.current_membership_id(household_id)
    and public.is_active_member(household_id)
  );

drop policy if exists guest_notices_update on public.guest_notices;
create policy guest_notices_update on public.guest_notices
  for update to authenticated
  using (
    host_membership_id = public.current_membership_id(household_id)
    or public.is_household_coordinator(household_id)
  )
  with check (public.is_active_member(household_id));

-- Coverage offers
drop policy if exists chore_coverage_offers_select on public.chore_coverage_offers;
create policy chore_coverage_offers_select on public.chore_coverage_offers
  for select to authenticated
  using (public.is_active_member(household_id));

drop policy if exists chore_coverage_offers_insert on public.chore_coverage_offers;
create policy chore_coverage_offers_insert on public.chore_coverage_offers
  for insert to authenticated
  with check (
    offered_by_membership_id = public.current_membership_id(household_id)
    and public.is_active_member(household_id)
  );

drop policy if exists chore_coverage_offers_update on public.chore_coverage_offers;
create policy chore_coverage_offers_update on public.chore_coverage_offers
  for update to authenticated
  using (public.is_active_member(household_id))
  with check (public.is_active_member(household_id));

-- Weekly reviews
drop policy if exists household_weekly_reviews_select on public.household_weekly_reviews;
create policy household_weekly_reviews_select on public.household_weekly_reviews
  for select to authenticated
  using (public.is_active_member(household_id));

drop policy if exists household_weekly_reviews_insert on public.household_weekly_reviews;
create policy household_weekly_reviews_insert on public.household_weekly_reviews
  for insert to authenticated
  with check (
    created_by_membership_id = public.current_membership_id(household_id)
    and public.is_active_member(household_id)
  );
