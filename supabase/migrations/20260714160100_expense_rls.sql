-- Phase 2: expense RLS policies and visibility helpers

create or replace function public.current_membership_id(p_household_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.id
  from public.household_memberships m
  where m.household_id = p_household_id
    and m.user_id = auth.uid()
    and m.status = 'active'
  limit 1;
$$;

revoke all on function public.current_membership_id(uuid) from public;
grant execute on function public.current_membership_id(uuid) to authenticated;

create or replace function public.can_view_expense(p_expense_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.expenses e
    where e.id = p_expense_id
      and public.is_active_member(e.household_id)
      and (
        e.status in ('ready_for_review', 'confirmed', 'amended', 'voided')
        or e.created_by_membership_id = public.current_membership_id(e.household_id)
        or e.payer_membership_id = public.current_membership_id(e.household_id)
      )
  );
$$;

create or replace function public.can_edit_expense_draft(p_expense_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.expenses e
    where e.id = p_expense_id
      and e.status in ('draft', 'ready_for_review')
      and public.is_active_member(e.household_id)
      and (
        e.created_by_membership_id = public.current_membership_id(e.household_id)
        or e.payer_membership_id = public.current_membership_id(e.household_id)
      )
  );
$$;

revoke all on function public.can_view_expense(uuid) from public;
revoke all on function public.can_edit_expense_draft(uuid) from public;
grant execute on function public.can_view_expense(uuid) to authenticated;
grant execute on function public.can_edit_expense_draft(uuid) to authenticated;

alter table public.expenses enable row level security;
alter table public.expense_items enable row level security;
alter table public.expense_item_allocations enable row level security;
alter table public.expense_adjustments enable row level security;
alter table public.expense_adjustment_allocations enable row level security;
alter table public.reimbursement_obligations enable row level security;
alter table public.expense_amendments enable row level security;

-- expenses
create policy expenses_select_member
  on public.expenses for select
  to authenticated
  using (public.can_view_expense(id));

create policy expenses_insert_member
  on public.expenses for insert
  to authenticated
  with check (
    public.is_active_member(household_id)
    and status = 'draft'
    and created_by_membership_id = public.current_membership_id(household_id)
    and public.membership_belongs_to_household(payer_membership_id, household_id)
  );

create policy expenses_update_draft_editor
  on public.expenses for update
  to authenticated
  using (public.can_edit_expense_draft(id))
  with check (
    public.can_edit_expense_draft(id)
    and status in ('draft', 'ready_for_review')
  );

create policy expenses_delete_draft_editor
  on public.expenses for delete
  to authenticated
  using (
    public.can_edit_expense_draft(id)
    and status in ('draft', 'ready_for_review')
  );

-- expense_items
create policy expense_items_select
  on public.expense_items for select
  to authenticated
  using (public.can_view_expense(expense_id));

create policy expense_items_insert
  on public.expense_items for insert
  to authenticated
  with check (public.can_edit_expense_draft(expense_id));

create policy expense_items_update
  on public.expense_items for update
  to authenticated
  using (public.can_edit_expense_draft(expense_id))
  with check (public.can_edit_expense_draft(expense_id));

create policy expense_items_delete
  on public.expense_items for delete
  to authenticated
  using (public.can_edit_expense_draft(expense_id));

-- expense_item_allocations
create policy expense_item_allocations_select
  on public.expense_item_allocations for select
  to authenticated
  using (public.can_view_expense(expense_id));

create policy expense_item_allocations_insert
  on public.expense_item_allocations for insert
  to authenticated
  with check (
    public.can_edit_expense_draft(expense_id)
    and public.membership_belongs_to_household(membership_id, household_id)
  );

create policy expense_item_allocations_update
  on public.expense_item_allocations for update
  to authenticated
  using (public.can_edit_expense_draft(expense_id))
  with check (
    public.can_edit_expense_draft(expense_id)
    and public.membership_belongs_to_household(membership_id, household_id)
  );

create policy expense_item_allocations_delete
  on public.expense_item_allocations for delete
  to authenticated
  using (public.can_edit_expense_draft(expense_id));

-- expense_adjustments
create policy expense_adjustments_select
  on public.expense_adjustments for select
  to authenticated
  using (public.can_view_expense(expense_id));

create policy expense_adjustments_insert
  on public.expense_adjustments for insert
  to authenticated
  with check (public.can_edit_expense_draft(expense_id));

create policy expense_adjustments_update
  on public.expense_adjustments for update
  to authenticated
  using (public.can_edit_expense_draft(expense_id))
  with check (public.can_edit_expense_draft(expense_id));

create policy expense_adjustments_delete
  on public.expense_adjustments for delete
  to authenticated
  using (public.can_edit_expense_draft(expense_id));

-- expense_adjustment_allocations
create policy expense_adjustment_allocations_select
  on public.expense_adjustment_allocations for select
  to authenticated
  using (public.can_view_expense(expense_id));

create policy expense_adjustment_allocations_insert
  on public.expense_adjustment_allocations for insert
  to authenticated
  with check (
    public.can_edit_expense_draft(expense_id)
    and public.membership_belongs_to_household(membership_id, household_id)
  );

create policy expense_adjustment_allocations_update
  on public.expense_adjustment_allocations for update
  to authenticated
  using (public.can_edit_expense_draft(expense_id))
  with check (
    public.can_edit_expense_draft(expense_id)
    and public.membership_belongs_to_household(membership_id, household_id)
  );

create policy expense_adjustment_allocations_delete
  on public.expense_adjustment_allocations for delete
  to authenticated
  using (public.can_edit_expense_draft(expense_id));

-- reimbursement_obligations: select only (writes via RPC)
create policy reimbursement_obligations_select
  on public.reimbursement_obligations for select
  to authenticated
  using (public.is_active_member(household_id));

-- expense_amendments
create policy expense_amendments_select
  on public.expense_amendments for select
  to authenticated
  using (public.is_active_member(household_id));

create policy expense_amendments_insert
  on public.expense_amendments for insert
  to authenticated
  with check (
    public.is_active_member(household_id)
    and created_by_membership_id = public.current_membership_id(household_id)
  );

create policy expense_amendments_update
  on public.expense_amendments for update
  to authenticated
  using (
    public.is_active_member(household_id)
    and created_by_membership_id = public.current_membership_id(household_id)
    and status = 'draft'
  )
  with check (
    public.is_active_member(household_id)
    and status in ('draft', 'cancelled')
  );
