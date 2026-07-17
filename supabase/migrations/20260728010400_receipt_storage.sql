-- Private expense receipt storage bucket

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expense-receipts',
  'expense-receipts',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists expense_receipts_storage_select on storage.objects;
drop policy if exists expense_receipts_storage_insert on storage.objects;
drop policy if exists expense_receipts_storage_update on storage.objects;
drop policy if exists expense_receipts_storage_delete on storage.objects;

-- Insert: any active member may upload under their household folder (register RPC binds uploader).
create policy expense_receipts_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'expense-receipts'
    and public.is_active_member((storage.foldername(name))[1]::uuid)
  );

-- Select / update / delete: only actors authorized for the matching receipt row.
create policy expense_receipts_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'expense-receipts'
    and public.can_view_expense_receipt_path(name)
  );

create policy expense_receipts_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'expense-receipts'
    and public.can_view_expense_receipt_path(name)
  );

create policy expense_receipts_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'expense-receipts'
    and (
      public.can_view_expense_receipt_path(name)
      or public._is_financial_coordinator((storage.foldername(name))[1]::uuid)
    )
  );
