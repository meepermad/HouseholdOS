-- Local OCR aliases + client extraction submission + OCR retention metadata

create table if not exists public.expense_receipt_aliases (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  kind text not null check (kind in ('merchant', 'item')),
  source_text text not null check (char_length(source_text) between 1 and 200),
  normalized_source text not null check (char_length(normalized_source) between 1 and 200),
  target_text text not null check (char_length(target_text) between 1 and 200),
  merchant_scope text not null default '' check (char_length(merchant_scope) <= 200),
  use_count int not null default 0 check (use_count >= 0),
  created_by_membership_id uuid references public.household_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, kind, normalized_source, merchant_scope)
);

create index if not exists expense_receipt_aliases_household_idx
  on public.expense_receipt_aliases(household_id, kind);

alter table public.expense_receipt_extractions
  add column if not exists ocr_full_text text,
  add column if not exists ocr_lines_json jsonb,
  add column if not exists processing_meta jsonb,
  add column if not exists retain_until timestamptz;

alter table public.expense_receipts
  add column if not exists extraction_mode text
    check (extraction_mode is null or extraction_mode in (
      'local_tesseract', 'openai', 'fixture', 'disabled', 'manual'
    )),
  add column if not exists unsynced_client_draft boolean not null default false;

create trigger expense_receipt_aliases_set_updated_at
  before update on public.expense_receipt_aliases
  for each row execute function public.set_updated_at();

alter table public.expense_receipt_aliases enable row level security;

create policy expense_receipt_aliases_select on public.expense_receipt_aliases
  for select to authenticated
  using (
    exists (
      select 1 from public.household_memberships m
      where m.household_id = expense_receipt_aliases.household_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

create policy expense_receipt_aliases_write on public.expense_receipt_aliases
  for all to authenticated
  using (
    exists (
      select 1 from public.household_memberships m
      where m.household_id = expense_receipt_aliases.household_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from public.household_memberships m
      where m.household_id = expense_receipt_aliases.household_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

-- Client-submitted local OCR extraction (uploader / financial coordinator only)
create or replace function public.submit_client_receipt_extraction(
  p_receipt_id uuid,
  p_adapter_name text,
  p_confidence numeric,
  p_proposed jsonb,
  p_content_hash text,
  p_line_items jsonb,
  p_ocr_full_text text default null,
  p_ocr_lines_json jsonb default null,
  p_processing_meta jsonb default null,
  p_duplicate_outcome text default 'none',
  p_duplicate_signals jsonb default '[]'::jsonb,
  p_match_receipt_id uuid default null,
  p_match_expense_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
  v_item jsonb;
  v_idx int := 0;
  v_retain_until timestamptz := now() + interval '7 days';
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.can_edit_expense_receipt(p_receipt_id) then
    raise exception 'Not authorized to submit extraction for this receipt';
  end if;

  select household_id into v_household_id
  from public.expense_receipts where id = p_receipt_id for update;
  if not found then raise exception 'Receipt not found'; end if;

  if (select status from public.expense_receipts where id = p_receipt_id) = 'confirmed' then
    raise exception 'Receipt already confirmed';
  end if;

  -- Idempotent: ignore if extraction already present with same content hash
  if exists (
    select 1 from public.expense_receipt_extractions e
    where e.receipt_id = p_receipt_id
      and e.content_hash is not null
      and e.content_hash = p_content_hash
      and p_content_hash is not null
      and length(p_content_hash) > 0
  ) then
    update public.expense_receipts
    set status = 'needs_review',
        extraction_mode = coalesce(p_adapter_name, extraction_mode),
        unsynced_client_draft = false,
        updated_at = now()
    where id = p_receipt_id;
    return;
  end if;

  insert into public.expense_receipt_extractions (
    receipt_id, household_id, adapter_name, confidence, proposed, content_hash,
    ocr_full_text, ocr_lines_json, processing_meta, retain_until
  ) values (
    p_receipt_id, v_household_id, coalesce(p_adapter_name, 'local_tesseract'),
    p_confidence, coalesce(p_proposed, '{}'::jsonb), p_content_hash,
    p_ocr_full_text, p_ocr_lines_json, p_processing_meta, v_retain_until
  );

  delete from public.expense_receipt_line_items where receipt_id = p_receipt_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_line_items, '[]'::jsonb))
  loop
    insert into public.expense_receipt_line_items (
      receipt_id, household_id, sort_index, ocr_text, corrected_name,
      quantity, unit_price_cents, total_price_cents, confidence, classification, review_status
    ) values (
      p_receipt_id, v_household_id, v_idx,
      v_item->>'ocrText',
      coalesce(v_item->>'name', v_item->>'ocrText'),
      nullif(v_item->>'quantity', '')::numeric,
      nullif(v_item->>'unitPriceCents', '')::int,
      nullif(v_item->>'totalPriceCents', '')::int,
      nullif(v_item->>'confidence', '')::numeric,
      'needs_review',
      'pending'
    );
    v_idx := v_idx + 1;
  end loop;

  update public.expense_receipts
  set status = 'needs_review',
      merchant_corrected = coalesce(p_proposed->>'merchant', merchant_corrected),
      purchase_date_corrected = coalesce((p_proposed->>'purchaseDate')::date, purchase_date_corrected),
      declared_total_cents = coalesce((p_proposed->>'totalCents')::int, declared_total_cents),
      currency = coalesce(p_proposed->>'currency', currency),
      extraction_mode = coalesce(p_adapter_name, 'local_tesseract'),
      unsynced_client_draft = false,
      updated_at = now()
  where id = p_receipt_id;

  update public.expense_receipt_jobs
  set status = 'succeeded', updated_at = now()
  where receipt_id = p_receipt_id and status in ('queued', 'claimed');

  insert into public.expense_receipt_duplicates (
    receipt_id, household_id, match_receipt_id, match_expense_id, outcome, signals
  ) values (
    p_receipt_id, v_household_id, p_match_receipt_id, p_match_expense_id,
    coalesce(p_duplicate_outcome, 'none'), coalesce(p_duplicate_signals, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.submit_client_receipt_extraction(
  uuid, text, numeric, jsonb, text, jsonb, text, jsonb, jsonb, text, jsonb, uuid, uuid
) from public;
grant execute on function public.submit_client_receipt_extraction(
  uuid, text, numeric, jsonb, text, jsonb, text, jsonb, jsonb, text, jsonb, uuid, uuid
) to authenticated;

create or replace function public.upsert_receipt_alias(
  p_household_id uuid,
  p_kind text,
  p_source_text text,
  p_target_text text,
  p_merchant_scope text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership_id uuid;
  v_norm text;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select id into v_membership_id
  from public.household_memberships
  where household_id = p_household_id and user_id = auth.uid() and status = 'active';
  if v_membership_id is null then raise exception 'Not a household member'; end if;

  v_norm := upper(trim(regexp_replace(p_source_text, '[^A-Za-z0-9%#]+', ' ', 'g')));
  v_norm := trim(regexp_replace(v_norm, '\s+', ' ', 'g'));

  insert into public.expense_receipt_aliases (
    household_id, kind, source_text, normalized_source, target_text,
    merchant_scope, created_by_membership_id, use_count
  ) values (
    p_household_id, p_kind, trim(p_source_text), v_norm, trim(p_target_text),
    coalesce(nullif(trim(p_merchant_scope), ''), ''), v_membership_id, 1
  )
  on conflict (household_id, kind, normalized_source, merchant_scope)
  do update set
    target_text = excluded.target_text,
    use_count = public.expense_receipt_aliases.use_count + 1,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.upsert_receipt_alias(uuid, text, text, text, text) from public;
grant execute on function public.upsert_receipt_alias(uuid, text, text, text, text) to authenticated;

create or replace function public.delete_receipt_alias(
  p_alias_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select household_id into v_household_id from public.expense_receipt_aliases where id = p_alias_id;
  if not found then raise exception 'Alias not found'; end if;
  if not exists (
    select 1 from public.household_memberships m
    where m.household_id = v_household_id and m.user_id = auth.uid() and m.status = 'active'
  ) then
    raise exception 'Not authorized';
  end if;
  delete from public.expense_receipt_aliases where id = p_alias_id;
end;
$$;

revoke all on function public.delete_receipt_alias(uuid) from public;
grant execute on function public.delete_receipt_alias(uuid) to authenticated;
