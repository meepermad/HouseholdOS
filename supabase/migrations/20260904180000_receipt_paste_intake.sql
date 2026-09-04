-- Pasted receipts: intake source + text/plain storage + dedicated register RPC.
-- Does not rewrite existing register_expense_receipt.

alter table public.expense_receipts
  add column if not exists intake_source text not null default 'upload';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'expense_receipts_intake_source_check'
  ) then
    alter table public.expense_receipts
      add constraint expense_receipts_intake_source_check
      check (intake_source in ('upload', 'camera', 'paste'));
  end if;
end
$$;

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'text/plain'
]
where id = 'expense-receipts';

create or replace function public.register_pasted_receipt(
  p_household_id uuid,
  p_storage_path text,
  p_mime_type text,
  p_file_name text,
  p_size_bytes int,
  p_file_hash text default null,
  p_idempotency_key text default null,
  p_payer_membership_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership_id uuid;
  v_id uuid;
  v_prefix text;
  v_payer uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_active_member(p_household_id) then
    raise exception 'Not an active household member';
  end if;
  v_membership_id := public.current_membership_id(p_household_id);
  v_prefix := p_household_id::text || '/';
  if p_storage_path is null or position(v_prefix in p_storage_path) <> 1 then
    raise exception 'Invalid receipt storage path';
  end if;

  v_payer := v_membership_id;
  if p_payer_membership_id is not null then
    if exists (
      select 1 from public.household_memberships m
      where m.id = p_payer_membership_id
        and m.household_id = p_household_id
        and m.status = 'active'
    ) then
      v_payer := p_payer_membership_id;
    end if;
  end if;

  if p_idempotency_key is not null and length(trim(p_idempotency_key)) >= 8 then
    select id into v_id
    from public.expense_receipts
    where household_id = p_household_id
      and register_idempotency_key = p_idempotency_key
      and deleted_at is null;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  insert into public.expense_receipts (
    household_id, uploaded_by_membership_id, payer_membership_id, storage_path, mime_type,
    file_name, size_bytes, file_hash, status, ocr_outcome, extraction_mode, intake_source,
    register_idempotency_key
  ) values (
    p_household_id, v_membership_id, v_payer, p_storage_path, p_mime_type,
    p_file_name, p_size_bytes, p_file_hash, 'uploaded', 'succeeded', 'manual', 'paste',
    nullif(trim(coalesce(p_idempotency_key, '')), '')
  ) returning id into v_id;

  insert into public.expense_receipt_jobs (receipt_id, household_id, status)
  values (v_id, p_household_id, 'queued');

  insert into public.audit_events (
    household_id, actor_user_id, entity_type, entity_id, event_type, after_state
  ) values (
    p_household_id, auth.uid(), 'expense_receipt', v_id, 'receipt.pasted',
    jsonb_build_object('mime_type', p_mime_type, 'intake_source', 'paste')
  );

  return v_id;
end;
$$;

revoke all on function public.register_pasted_receipt(uuid, text, text, text, int, text, text, uuid) from public;
grant execute on function public.register_pasted_receipt(uuid, text, text, text, int, text, text, uuid) to authenticated;
