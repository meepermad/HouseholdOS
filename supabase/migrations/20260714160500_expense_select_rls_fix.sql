-- Fix expense RLS SELECT policies to evaluate row columns directly.
-- Using can_view_expense(id) re-queries expenses and breaks INSERT...RETURNING under RLS.

drop policy if exists expenses_select_member on public.expenses;
create policy expenses_select_member
  on public.expenses for select
  to authenticated
  using (
    public.is_active_member(household_id)
    and (
      status in ('ready_for_review', 'confirmed', 'amended', 'voided')
      or created_by_membership_id = public.current_membership_id(household_id)
      or payer_membership_id = public.current_membership_id(household_id)
    )
  );

drop policy if exists expense_items_select on public.expense_items;
create policy expense_items_select
  on public.expense_items for select
  to authenticated
  using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id
        and public.is_active_member(e.household_id)
        and (
          e.status in ('ready_for_review', 'confirmed', 'amended', 'voided')
          or e.created_by_membership_id = public.current_membership_id(e.household_id)
          or e.payer_membership_id = public.current_membership_id(e.household_id)
        )
    )
  );

drop policy if exists expense_item_allocations_select on public.expense_item_allocations;
create policy expense_item_allocations_select
  on public.expense_item_allocations for select
  to authenticated
  using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id
        and public.is_active_member(e.household_id)
        and (
          e.status in ('ready_for_review', 'confirmed', 'amended', 'voided')
          or e.created_by_membership_id = public.current_membership_id(e.household_id)
          or e.payer_membership_id = public.current_membership_id(e.household_id)
        )
    )
  );

drop policy if exists expense_adjustments_select on public.expense_adjustments;
create policy expense_adjustments_select
  on public.expense_adjustments for select
  to authenticated
  using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id
        and public.is_active_member(e.household_id)
        and (
          e.status in ('ready_for_review', 'confirmed', 'amended', 'voided')
          or e.created_by_membership_id = public.current_membership_id(e.household_id)
          or e.payer_membership_id = public.current_membership_id(e.household_id)
        )
    )
  );

drop policy if exists expense_adjustment_allocations_select on public.expense_adjustment_allocations;
create policy expense_adjustment_allocations_select
  on public.expense_adjustment_allocations for select
  to authenticated
  using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id
        and public.is_active_member(e.household_id)
        and (
          e.status in ('ready_for_review', 'confirmed', 'amended', 'voided')
          or e.created_by_membership_id = public.current_membership_id(e.household_id)
          or e.payer_membership_id = public.current_membership_id(e.household_id)
        )
    )
  );
