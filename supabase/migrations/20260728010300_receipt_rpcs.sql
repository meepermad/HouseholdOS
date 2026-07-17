-- Receipt RPCs: register, enqueue, claim, complete extraction, review, confirm as draft expense

create or replace function public.register_expense_receipt(
  p_household_id uuid,
  p_storage_path text,
  p_mime_type text,
  p_file_name text,
  p_size_bytes int,
  p_file_hash text default null,
  p_perceptual_hash text default null
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

  insert into public.expense_receipts (
    household_id, uploaded_by_membership_id, storage_path, mime_type,
    file_name, size_bytes, file_hash, perceptual_hash, status
  ) values (
    p_household_id, v_membership_id, p_storage_path, p_mime_type,
    p_file_name, p_size_bytes, p_file_hash, p_perceptual_hash, 'uploaded'
  ) returning id into v_id;

  insert into public.expense_receipt_jobs (receipt_id, household_id, status)
  values (v_id, p_household_id, 'queued');

  insert into public.audit_events (
    household_id, actor_user_id, entity_type, entity_id, event_type, after_state
  ) values (
    p_household_id, auth.uid(), 'expense_receipt', v_id, 'receipt.uploaded',
    jsonb_build_object('mime_type', p_mime_type, 'size_bytes', p_size_bytes)
  );

  return v_id;
end;
$$;

create or replace function public.claim_receipt_extraction_jobs(
  p_batch_size int default 10,
  p_worker_id uuid default gen_random_uuid(),
  p_claim_ttl_seconds int default 180
)
returns setof public.expense_receipt_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := greatest(1, least(coalesce(p_batch_size, 10), 50));
begin
  -- service_role / privileged worker only (no auth.uid required when using service key)
  return query
  with picked as (
    select j.id
    from public.expense_receipt_jobs j
    where (
      (j.status = 'queued' and j.available_at <= now())
      or (
        j.status = 'claimed'
        and j.claimed_at is not null
        and j.claimed_at < now() - make_interval(secs => greatest(p_claim_ttl_seconds, 30))
      )
    )
    order by j.available_at, j.created_at
    for update of j skip locked
    limit v_limit
  )
  update public.expense_receipt_jobs j
  set status = 'claimed',
      claimed_by = p_worker_id,
      claimed_at = now(),
      attempts = j.attempts + 1,
      updated_at = now()
  from picked
  where j.id = picked.id
  returning j.*;
end;
$$;

create or replace function public.complete_receipt_extraction(
  p_receipt_id uuid,
  p_adapter_name text,
  p_confidence numeric,
  p_proposed jsonb,
  p_content_hash text,
  p_line_items jsonb,
  p_duplicate_outcome text default 'none',
  p_duplicate_signals jsonb default '[]'::jsonb,
  p_match_receipt_id uuid default null,
  p_match_expense_id uuid default null,
  p_configured boolean default true,
  p_error text default null
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
begin
  select household_id into v_household_id
  from public.expense_receipts where id = p_receipt_id for update;
  if not found then raise exception 'Receipt not found'; end if;

  update public.expense_receipt_jobs
  set status = case when p_error is not null and not coalesce(p_configured, true) then 'succeeded'
                    when p_error is not null then 'failed'
                    else 'succeeded' end,
      last_error = p_error,
      updated_at = now()
  where receipt_id = p_receipt_id and status = 'claimed';

  if p_error is not null and coalesce(p_configured, true) = false then
    -- Manual review path when OCR not configured
    update public.expense_receipts
    set status = 'needs_review', updated_at = now()
    where id = p_receipt_id;
    return;
  end if;

  if p_error is not null then
    update public.expense_receipts
    set status = 'failed', updated_at = now()
    where id = p_receipt_id;
    return;
  end if;

  insert into public.expense_receipt_extracted (
    receipt_id, household_id, adapter_name, confidence, proposed, content_hash
  ) values (
    p_receipt_id, v_household_id, p_adapter_name, p_confidence, coalesce(p_proposed, '{}'::jsonb), p_content_hash
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
      updated_at = now()
  where id = p_receipt_id;

  insert into public.expense_receipt_duplicates (
    receipt_id, household_id, match_receipt_id, match_expense_id, outcome, signals
  ) values (
    p_receipt_id, v_household_id, p_match_receipt_id, p_match_expense_id,
    coalesce(p_duplicate_outcome, 'none'), coalesce(p_duplicate_signals, '[]'::jsonb)
  );
end;
$$;

create or replace function public.update_receipt_review(
  p_receipt_id uuid,
  p_merchant text default null,
  p_purchase_date date default null,
  p_declared_total_cents int default null,
  p_currency text default null,
  p_notes text default null,
  p_line_items jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
  v_item jsonb;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select household_id into v_household_id from public.expense_receipts where id = p_receipt_id for update;
  if not found then raise exception 'Receipt not found'; end if;
  if not public.is_active_member(v_household_id) then
    raise exception 'Not an active household member';
  end if;
  if (select status from public.expense_receipts where id = p_receipt_id) = 'confirmed' then
    raise exception 'Receipt already confirmed';
  end if;

  update public.expense_receipts
  set merchant_corrected = coalesce(p_merchant, merchant_corrected),
      purchase_date_corrected = coalesce(p_purchase_date, purchase_date_corrected),
      declared_total_cents = coalesce(p_declared_total_cents, declared_total_cents),
      currency = coalesce(p_currency, currency),
      notes = coalesce(p_notes, notes),
      status = 'needs_review',
      updated_at = now()
  where id = p_receipt_id;

  if p_line_items is not null then
    delete from public.expense_receipt_line_items where receipt_id = p_receipt_id;
    for v_item in select * from jsonb_array_elements(p_line_items)
    loop
      insert into public.expense_receipt_line_items (
        receipt_id, household_id, sort_index, ocr_text, corrected_name,
        quantity, unit_price_cents, total_price_cents, classification, category,
        participant_membership_ids, resource_destination, confidence, review_status
      ) values (
        p_receipt_id, v_household_id,
        coalesce((v_item->>'sortIndex')::int, 0),
        v_item->>'ocrText',
        v_item->>'correctedName',
        nullif(v_item->>'quantity', '')::numeric,
        nullif(v_item->>'unitPriceCents', '')::int,
        nullif(v_item->>'totalPriceCents', '')::int,
        coalesce(v_item->>'classification', 'needs_review'),
        v_item->>'category',
        coalesce(
          (select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(v_item->'participantMembershipIds', '[]'::jsonb)) as x),
          '{}'::uuid[]
        ),
        coalesce(v_item->>'resourceDestination', 'none'),
        nullif(v_item->>'confidence', '')::numeric,
        coalesce(v_item->>'reviewStatus', 'corrected')
      );
    end loop;
  end if;
end;
$$;

create or replace function public.confirm_receipt_as_expense(
  p_receipt_id uuid,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt public.expense_receipts%rowtype;
  v_membership_id uuid;
  v_expense_id uuid;
  v_item public.expense_receipt_line_items%rowtype;
  v_expense_item_id uuid;
  v_mode text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_idempotency_key is null or char_length(trim(p_idempotency_key)) < 8 then
    raise exception 'Idempotency key required';
  end if;

  select * into v_receipt from public.expense_receipts where id = p_receipt_id for update;
  if not found or v_receipt.deleted_at is not null then
    raise exception 'Receipt not found';
  end if;
  if not public.is_active_member(v_receipt.household_id) then
    raise exception 'Not an active household member';
  end if;
  v_membership_id := public.current_membership_id(v_receipt.household_id);

  if v_receipt.expense_id is not null and v_receipt.confirm_idempotency_key = p_idempotency_key then
    return v_receipt.expense_id;
  end if;
  if v_receipt.status = 'confirmed' and v_receipt.expense_id is not null then
    raise exception 'Receipt already confirmed';
  end if;

  insert into public.expenses (
    household_id, created_by_membership_id, payer_membership_id,
    merchant, purchase_date, description, category, currency,
    declared_total_cents, calculated_subtotal_cents, calculated_adjustments_cents,
    status
  ) values (
    v_receipt.household_id, v_membership_id, v_receipt.uploaded_by_membership_id,
    coalesce(v_receipt.merchant_corrected, 'Receipt'),
    coalesce(v_receipt.purchase_date_corrected, current_date),
    'Imported from receipt',
    'other',
    v_receipt.currency,
    coalesce(v_receipt.declared_total_cents, 0),
    0, 0,
    'draft'
  ) returning id into v_expense_id;

  for v_item in
    select * from public.expense_receipt_line_items
    where receipt_id = p_receipt_id
      and classification <> 'excluded'
    order by sort_index
  loop
    v_mode := case v_item.classification
      when 'personal_purchaser' then 'personal'
      when 'personal_other' then 'personal'
      when 'shared_selected' then 'equal_selected'
      when 'excluded' then 'excluded'
      else 'equal_all'
    end;

    insert into public.expense_items (
      expense_id, household_id, description, total_cents,
      allocation_mode, classification, display_order, quantity_label
    ) values (
      v_expense_id, v_receipt.household_id,
      coalesce(v_item.corrected_name, v_item.ocr_text, 'Item'),
      coalesce(v_item.total_price_cents, v_item.unit_price_cents, 0),
      v_mode,
      v_item.classification,
      v_item.sort_index,
      case when v_item.quantity is null then null else v_item.quantity::text end
    ) returning id into v_expense_item_id;

    update public.expense_receipt_line_items
    set expense_item_id = v_expense_item_id
    where id = v_item.id;
  end loop;

  update public.expense_receipts
  set status = 'confirmed',
      expense_id = v_expense_id,
      confirm_idempotency_key = p_idempotency_key,
      updated_at = now()
  where id = p_receipt_id;

  insert into public.audit_events (
    household_id, actor_user_id, entity_type, entity_id, event_type, after_state
  ) values (
    v_receipt.household_id, auth.uid(), 'expense_receipt', p_receipt_id,
    'receipt.confirmed_as_expense',
    jsonb_build_object('expense_id', v_expense_id)
  );

  return v_expense_id;
end;
$$;

revoke all on function public.register_expense_receipt(uuid, text, text, text, int, text, text) from public;
revoke all on function public.claim_receipt_extraction_jobs(int, uuid, int) from public;
revoke all on function public.complete_receipt_extraction(uuid, text, numeric, jsonb, text, jsonb, text, jsonb, uuid, uuid, boolean, text) from public;
revoke all on function public.update_receipt_review(uuid, text, date, int, text, text, jsonb) from public;
revoke all on function public.confirm_receipt_as_expense(uuid, text) from public;

grant execute on function public.register_expense_receipt(uuid, text, text, text, int, text, text) to authenticated;
grant execute on function public.update_receipt_review(uuid, text, date, int, text, text, jsonb) to authenticated;
grant execute on function public.confirm_receipt_as_expense(uuid, text) to authenticated;
-- claim + complete intended for service_role worker
grant execute on function public.claim_receipt_extraction_jobs(int, uuid, int) to service_role;
grant execute on function public.complete_receipt_extraction(uuid, text, numeric, jsonb, text, jsonb, text, jsonb, uuid, uuid, boolean, text) to service_role;
