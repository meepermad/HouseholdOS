-- Receipt RLS: active members read non-deleted; mutations via SECURITY DEFINER RPCs only

alter table public.expense_receipts enable row level security;
alter table public.expense_receipt_extracted enable row level security;
alter table public.expense_receipt_line_items enable row level security;
alter table public.expense_receipt_duplicates enable row level security;
alter table public.expense_receipt_jobs enable row level security;

create policy expense_receipts_select on public.expense_receipts
  for select to authenticated
  using (public.is_active_member(household_id) and deleted_at is null);

create policy expense_receipt_extracted_select on public.expense_receipt_extracted
  for select to authenticated
  using (public.is_active_member(household_id));

create policy expense_receipt_line_items_select on public.expense_receipt_line_items
  for select to authenticated
  using (public.is_active_member(household_id));

create policy expense_receipt_duplicates_select on public.expense_receipt_duplicates
  for select to authenticated
  using (public.is_active_member(household_id));

-- Jobs are worker-facing; members can see status via receipt row
create policy expense_receipt_jobs_select on public.expense_receipt_jobs
  for select to authenticated
  using (public.is_active_member(household_id));

-- Deny direct writes from authenticated clients
create policy expense_receipts_no_direct_write on public.expense_receipts
  for insert to authenticated with check (false);
create policy expense_receipts_no_direct_update on public.expense_receipts
  for update to authenticated using (false);
create policy expense_receipts_no_direct_delete on public.expense_receipts
  for delete to authenticated using (false);

create policy expense_receipt_extracted_no_write on public.expense_receipt_extracted
  for all to authenticated using (false) with check (false);
create policy expense_receipt_line_items_no_write on public.expense_receipt_line_items
  for all to authenticated using (false) with check (false);
create policy expense_receipt_duplicates_no_write on public.expense_receipt_duplicates
  for all to authenticated using (false) with check (false);
create policy expense_receipt_jobs_no_write on public.expense_receipt_jobs
  for all to authenticated using (false) with check (false);
