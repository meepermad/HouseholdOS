-- Receipt RLS: draft-or-linked-expense authorization (not all active members)

alter table public.expense_receipts enable row level security;
alter table public.expense_receipt_extractions enable row level security;
alter table public.expense_receipt_line_items enable row level security;
alter table public.expense_receipt_duplicates enable row level security;
alter table public.expense_receipt_jobs enable row level security;

-- Who may view a receipt draft or linked receipt:
-- uploader, financial coordinator, or (when linked) expense creator / payer / allocation participant.
create or replace function public.can_view_expense_receipt(p_receipt_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.expense_receipts r
    where r.id = p_receipt_id
      and r.deleted_at is null
      and public.is_active_member(r.household_id)
      and (
        r.uploaded_by_membership_id = public.current_membership_id(r.household_id)
        or public._is_financial_coordinator(r.household_id)
        or (
          r.expense_id is not null
          and exists (
            select 1
            from public.expenses e
            where e.id = r.expense_id
              and e.household_id = r.household_id
              and (
                e.created_by_membership_id = public.current_membership_id(r.household_id)
                or e.payer_membership_id = public.current_membership_id(r.household_id)
                or exists (
                  select 1
                  from public.expense_item_allocations a
                  where a.expense_id = e.id
                    and a.membership_id = public.current_membership_id(r.household_id)
                )
              )
          )
        )
      )
  );
$$;

create or replace function public.can_edit_expense_receipt(p_receipt_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.expense_receipts r
    where r.id = p_receipt_id
      and r.deleted_at is null
      and r.status <> 'confirmed'
      and public.is_active_member(r.household_id)
      and (
        r.uploaded_by_membership_id = public.current_membership_id(r.household_id)
        or public._is_financial_coordinator(r.household_id)
      )
  );
$$;

create or replace function public.can_view_expense_receipt_path(p_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.expense_receipts r
    where r.storage_path = p_storage_path
      and public.can_view_expense_receipt(r.id)
  );
$$;

revoke all on function public.can_view_expense_receipt(uuid) from public, anon;
revoke all on function public.can_edit_expense_receipt(uuid) from public, anon;
revoke all on function public.can_view_expense_receipt_path(text) from public, anon;
grant execute on function public.can_view_expense_receipt(uuid) to authenticated;
grant execute on function public.can_edit_expense_receipt(uuid) to authenticated;
grant execute on function public.can_view_expense_receipt_path(text) to authenticated;

create policy expense_receipts_select on public.expense_receipts
  for select to authenticated
  using (public.can_view_expense_receipt(id));

create policy expense_receipt_extractions_select on public.expense_receipt_extractions
  for select to authenticated
  using (public.can_view_expense_receipt(receipt_id));

create policy expense_receipt_line_items_select on public.expense_receipt_line_items
  for select to authenticated
  using (public.can_view_expense_receipt(receipt_id));

create policy expense_receipt_duplicates_select on public.expense_receipt_duplicates
  for select to authenticated
  using (public.can_view_expense_receipt(receipt_id));

-- Jobs status is visible only to actors who can view the receipt
create policy expense_receipt_jobs_select on public.expense_receipt_jobs
  for select to authenticated
  using (public.can_view_expense_receipt(receipt_id));

-- Deny direct writes from authenticated clients
create policy expense_receipts_no_direct_write on public.expense_receipts
  for insert to authenticated with check (false);
create policy expense_receipts_no_direct_update on public.expense_receipts
  for update to authenticated using (false);
create policy expense_receipts_no_direct_delete on public.expense_receipts
  for delete to authenticated using (false);

create policy expense_receipt_extractions_no_write on public.expense_receipt_extractions
  for all to authenticated using (false) with check (false);
create policy expense_receipt_line_items_no_write on public.expense_receipt_line_items
  for all to authenticated using (false) with check (false);
create policy expense_receipt_duplicates_no_write on public.expense_receipt_duplicates
  for all to authenticated using (false) with check (false);
create policy expense_receipt_jobs_no_write on public.expense_receipt_jobs
  for all to authenticated using (false) with check (false);
