-- Grant table privileges for Phase 2 financial tables to authenticated role

grant select, insert, update, delete on public.expenses to authenticated;
grant select, insert, update, delete on public.expense_items to authenticated;
grant select, insert, update, delete on public.expense_item_allocations to authenticated;
grant select, insert, update, delete on public.expense_adjustments to authenticated;
grant select, insert, update, delete on public.expense_adjustment_allocations to authenticated;
grant select on public.reimbursement_obligations to authenticated;
grant select, insert, update on public.expense_amendments to authenticated;
