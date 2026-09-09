-- Pasted receipt display names + same-receipt re-paste revisions.
-- Does not rewrite applied migrations.

create or replace function public._receipt_pasted_display_name(p_name text, p_source text)
returns text
language plpgsql
immutable
as $$
declare
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_source text := nullif(btrim(coalesce(p_source, '')), '');
  v_pipe int;
begin
  if v_name is not null and position('|' in v_name) = 0 then
    return left(v_name, 200);
  end if;
  if v_source is not null then
    v_pipe := position('|' in v_source);
    if v_pipe > 1 then
      return left(btrim(substr(v_source, 1, v_pipe - 1)), 200);
    end if;
    if v_name is null then
      return left(v_source, 200);
    end if;
  end if;
  if v_name is not null then
    v_pipe := position('|' in v_name);
    if v_pipe > 1 then
      return left(btrim(substr(v_name, 1, v_pipe - 1)), 200);
    end if;
    return left(v_name, 200);
  end if;
  return null;
end;
$$;

alter table public.expense_receipt_line_items
  add column if not exists source_text text,
  add column if not exists description_source text not null default 'ocr',
  add column if not exists description_edited_by_user boolean not null default false,
  add column if not exists claim_review_required boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'expense_receipt_line_items_description_source_check'
  ) then
    alter table public.expense_receipt_line_items
      add constraint expense_receipt_line_items_description_source_check
      check (description_source in ('pasted', 'ocr', 'manually_edited', 'enrichment_suggestion'));
  end if;
end
$$;

alter table public.expense_receipts
  add column if not exists financial_review_required boolean not null default false,
  add column if not exists transcription_corrected boolean not null default false,
  add column if not exists active_transcription_revision_id uuid,
  add column if not exists last_repaste_idempotency_key text;

create table if not exists public.expense_receipt_transcription_revisions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  receipt_id uuid not null,
  revision_number int not null,
  source_text text not null,
  parsed_payload jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  reason text not null check (reason in ('initial_paste', 'user_repaste')),
  became_active_at timestamptz not null default now(),
  superseded_at timestamptz,
  unique (receipt_id, revision_number),
  unique (id, household_id),
  foreign key (receipt_id, household_id)
    references public.expense_receipts(id, household_id) on delete cascade,
  foreign key (created_by)
    references public.household_memberships(id) on delete restrict
);

create index if not exists expense_receipt_transcription_revisions_receipt_idx
  on public.expense_receipt_transcription_revisions(receipt_id, revision_number desc);

alter table public.expense_receipt_transcription_revisions enable row level security;

drop policy if exists expense_receipt_transcription_revisions_select on public.expense_receipt_transcription_revisions;
create policy expense_receipt_transcription_revisions_select
  on public.expense_receipt_transcription_revisions
  for select to authenticated
  using (public.can_view_expense_receipt(receipt_id));

drop policy if exists expense_receipt_transcription_revisions_no_write on public.expense_receipt_transcription_revisions;
create policy expense_receipt_transcription_revisions_no_write
  on public.expense_receipt_transcription_revisions
  for all to authenticated
  using (false)
  with check (false);

grant select on public.expense_receipt_transcription_revisions to authenticated;

update public.expense_receipt_line_items li
set
  source_text = coalesce(li.source_text, li.ocr_text),
  corrected_name = coalesce(
    public._receipt_pasted_display_name(li.corrected_name, coalesce(li.source_text, li.ocr_text)),
    li.corrected_name
  ),
  description_source = case
    when li.description_source = 'ocr' then 'pasted'
    else li.description_source
  end
from public.expense_receipts r
where li.receipt_id = r.id
  and r.intake_source = 'paste';

create or replace function public._receipt_insert_transcription_revision(
  p_receipt_id uuid,
  p_household_id uuid,
  p_source_text text,
  p_parsed_payload jsonb,
  p_reason text,
  p_created_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next int;
  v_id uuid;
begin
  update public.expense_receipt_transcription_revisions
  set superseded_at = now()
  where receipt_id = p_receipt_id
    and superseded_at is null;

  select coalesce(max(revision_number), 0) + 1
  into v_next
  from public.expense_receipt_transcription_revisions
  where receipt_id = p_receipt_id;

  insert into public.expense_receipt_transcription_revisions (
    household_id, receipt_id, revision_number, source_text, parsed_payload,
    created_by, reason, became_active_at
  ) values (
    p_household_id, p_receipt_id, v_next, left(coalesce(p_source_text, ''), 50000),
    coalesce(p_parsed_payload, '{}'::jsonb), p_created_by, p_reason, now()
  ) returning id into v_id;

  update public.expense_receipts
  set active_transcription_revision_id = v_id,
      transcription_corrected = case when p_reason = 'user_repaste' then true else transcription_corrected end,
      updated_at = now()
  where id = p_receipt_id;

  return v_id;
end;
$$;

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
  v_source text;
  v_name text;
  v_desc_source text;
  v_pasted boolean := false;
  v_actor uuid;
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

  v_pasted := coalesce(p_processing_meta->>'source', '') = 'paste'
    or exists (
      select 1 from public.expense_receipts r
      where r.id = p_receipt_id and r.intake_source = 'paste'
    );

  delete from public.expense_receipt_line_items where receipt_id = p_receipt_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_line_items, '[]'::jsonb))
  loop
    v_source := coalesce(nullif(btrim(v_item->>'sourceText'), ''), nullif(btrim(v_item->>'ocrText'), ''));
    v_name := public._receipt_pasted_display_name(
      coalesce(nullif(btrim(v_item->>'displayDescription'), ''), nullif(btrim(v_item->>'name'), '')),
      v_source
    );
    v_desc_source := coalesce(
      nullif(btrim(v_item->>'descriptionSource'), ''),
      case when v_pasted then 'pasted' else 'ocr' end
    );
    insert into public.expense_receipt_line_items (
      receipt_id, household_id, sort_index, ocr_text, corrected_name,
      source_text, description_source, description_edited_by_user,
      quantity, unit_price_cents, total_price_cents, confidence, classification, review_status
    ) values (
      p_receipt_id, v_household_id, v_idx,
      v_source,
      v_name,
      v_source,
      case when v_desc_source in ('pasted','ocr','manually_edited','enrichment_suggestion')
        then v_desc_source else case when v_pasted then 'pasted' else 'ocr' end end,
      false,
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

  if v_pasted and coalesce(p_ocr_full_text, '') <> '' then
    v_actor := public.current_membership_id(v_household_id);
    perform public._receipt_insert_transcription_revision(
      p_receipt_id,
      v_household_id,
      p_ocr_full_text,
      jsonb_build_object('proposed', coalesce(p_proposed, '{}'::jsonb), 'lineItems', coalesce(p_line_items, '[]'::jsonb)),
      'initial_paste',
      v_actor
    );
  end if;

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
  v_has_ids boolean := false;
  v_id uuid;
  v_source text;
  v_name text;
  v_prev text;
  v_edited boolean;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select household_id into v_household_id from public.expense_receipts where id = p_receipt_id for update;
  if not found then raise exception 'Receipt not found'; end if;
  if not public.can_edit_expense_receipt(p_receipt_id) then
    raise exception 'Not authorized to edit this receipt';
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
      status = case when status in ('claiming','ready_for_review') then status else 'needs_review' end,
      updated_at = now()
  where id = p_receipt_id;

  if p_line_items is null then
    return;
  end if;

  select exists (
    select 1
    from jsonb_array_elements(p_line_items) x
    where nullif(btrim(x->>'id'), '') is not null
  ) into v_has_ids;

  if v_has_ids then
    for v_item in select * from jsonb_array_elements(p_line_items)
    loop
      v_id := nullif(btrim(v_item->>'id'), '')::uuid;
      v_source := coalesce(nullif(btrim(v_item->>'sourceText'), ''), nullif(btrim(v_item->>'ocrText'), ''));
      v_name := public._receipt_pasted_display_name(
        coalesce(nullif(btrim(v_item->>'displayDescription'), ''), nullif(btrim(v_item->>'correctedName'), '')),
        v_source
      );
      v_edited := coalesce((v_item->>'descriptionEditedByUser')::boolean, false);
      if v_id is null then
        insert into public.expense_receipt_line_items (
          receipt_id, household_id, sort_index, ocr_text, corrected_name,
          source_text, description_source, description_edited_by_user,
          quantity, unit_price_cents, total_price_cents, classification, category,
          participant_membership_ids, resource_destination, confidence, review_status
        ) values (
          p_receipt_id, v_household_id,
          coalesce((v_item->>'sortIndex')::int, 0),
          v_source,
          v_name,
          v_source,
          case when v_edited then 'manually_edited' else 'pasted' end,
          v_edited,
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
      else
        select corrected_name into v_prev
        from public.expense_receipt_line_items
        where id = v_id and receipt_id = p_receipt_id;
        if not found then
          raise exception 'Line not found';
        end if;
        update public.expense_receipt_line_items
        set sort_index = coalesce((v_item->>'sortIndex')::int, sort_index),
            ocr_text = coalesce(v_source, ocr_text),
            source_text = coalesce(v_source, source_text),
            corrected_name = coalesce(v_name, corrected_name),
            description_edited_by_user = description_edited_by_user or v_edited or (v_name is not null and v_name is distinct from v_prev),
            description_source = case
              when v_edited or (v_name is not null and v_name is distinct from v_prev) then 'manually_edited'
              else description_source
            end,
            quantity = coalesce(nullif(v_item->>'quantity', '')::numeric, quantity),
            unit_price_cents = coalesce(nullif(v_item->>'unitPriceCents', '')::int, unit_price_cents),
            total_price_cents = coalesce(nullif(v_item->>'totalPriceCents', '')::int, total_price_cents),
            classification = coalesce(v_item->>'classification', classification),
            review_status = coalesce(v_item->>'reviewStatus', review_status),
            updated_at = now()
        where id = v_id and receipt_id = p_receipt_id;
      end if;
    end loop;
    return;
  end if;

  delete from public.expense_receipt_line_items where receipt_id = p_receipt_id;
  for v_item in select * from jsonb_array_elements(p_line_items)
  loop
    v_source := coalesce(nullif(btrim(v_item->>'sourceText'), ''), nullif(btrim(v_item->>'ocrText'), ''));
    v_name := public._receipt_pasted_display_name(
      coalesce(nullif(btrim(v_item->>'displayDescription'), ''), nullif(btrim(v_item->>'correctedName'), '')),
      v_source
    );
    insert into public.expense_receipt_line_items (
      receipt_id, household_id, sort_index, ocr_text, corrected_name,
      source_text, description_source,
      quantity, unit_price_cents, total_price_cents, classification, category,
      participant_membership_ids, resource_destination, confidence, review_status
    ) values (
      p_receipt_id, v_household_id,
      coalesce((v_item->>'sortIndex')::int, 0),
      v_source,
      v_name,
      v_source,
      'pasted',
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
end;
$$;

create or replace function public.apply_receipt_repaste(
  p_receipt_id uuid,
  p_source_text text,
  p_parsed_payload jsonb,
  p_plan jsonb,
  p_idempotency_key text,
  p_reason text default 'user_repaste'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt public.expense_receipts%rowtype;
  v_actor uuid;
  v_item jsonb;
  v_action text;
  v_id uuid;
  v_sort int := 0;
  v_qty numeric;
  v_total int;
  v_name text;
  v_source text;
  v_unit int;
  v_claimed numeric;
  v_notify boolean := false;
  v_financial boolean := false;
  v_recipients uuid[];
  v_merchant text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_idempotency_key is null or char_length(trim(p_idempotency_key)) < 8 then
    raise exception 'Idempotency key required';
  end if;
  if coalesce(p_reason, 'user_repaste') not in ('initial_paste', 'user_repaste') then
    raise exception 'Invalid revision reason';
  end if;

  select * into v_receipt from public.expense_receipts where id = p_receipt_id for update;
  if not found or v_receipt.deleted_at is not null then
    raise exception 'Receipt not found';
  end if;
  if not public.can_edit_expense_receipt(p_receipt_id) then
    raise exception 'Not authorized to edit this receipt';
  end if;
  if v_receipt.status = 'confirmed' then
    raise exception 'RECEIPT_ALREADY_CONFIRMED';
  end if;
  if v_receipt.status not in ('uploaded','extracting','needs_review','claiming','ready_for_review','failed') then
    raise exception 'RECEIPT_NOT_EDITABLE';
  end if;
  if v_receipt.last_repaste_idempotency_key is not null
     and v_receipt.last_repaste_idempotency_key = p_idempotency_key then
    return p_receipt_id;
  end if;

  v_actor := public.current_membership_id(v_receipt.household_id);
  v_notify := coalesce((p_plan->>'notify')::boolean, false);
  v_financial := coalesce((p_plan->>'financialReviewRequired')::boolean, false);

  perform id from public.expense_receipt_line_items
  where receipt_id = p_receipt_id
  order by id
  for update;

  for v_item in select * from jsonb_array_elements(coalesce(p_plan->'lines', '[]'::jsonb))
  loop
    v_action := v_item->>'action';
    v_id := nullif(btrim(v_item->>'id'), '')::uuid;
    v_source := left(coalesce(v_item->>'sourceText', ''), 2000);
    v_name := public._receipt_pasted_display_name(v_item->>'displayDescription', v_source);
    v_qty := coalesce(nullif(v_item->>'quantity', '')::numeric, 1);
    v_total := coalesce(nullif(v_item->>'totalCents', '')::int, 0);
    v_unit := case when v_qty > 1 then trunc(v_total / v_qty) else v_total end;

    if v_action in ('keep','update') then
      if v_id is null then raise exception 'Line identity required'; end if;
      if not exists (
        select 1 from public.expense_receipt_line_items
        where id = v_id and receipt_id = p_receipt_id
      ) then
        raise exception 'Line not found';
      end if;
      update public.expense_receipt_line_items
      set sort_index = v_sort,
          source_text = v_source,
          ocr_text = v_source,
          corrected_name = case
            when coalesce((v_item->>'preserveDescription')::boolean, false) then corrected_name
            else coalesce(v_name, corrected_name)
          end,
          description_source = case
            when coalesce((v_item->>'preserveDescription')::boolean, false) then description_source
            when description_edited_by_user then description_source
            else 'pasted'
          end,
          quantity = v_qty,
          total_price_cents = v_total,
          unit_price_cents = v_unit,
          claim_review_required = coalesce((v_item->>'claimReviewRequired')::boolean, false),
          updated_at = now()
      where id = v_id and receipt_id = p_receipt_id;
      v_sort := v_sort + 1;
    elsif v_action = 'add' then
      insert into public.expense_receipt_line_items (
        receipt_id, household_id, sort_index, ocr_text, corrected_name,
        source_text, description_source, quantity, unit_price_cents, total_price_cents,
        classification, review_status
      ) values (
        p_receipt_id, v_receipt.household_id, v_sort, v_source, v_name,
        v_source, 'pasted', v_qty, v_unit, v_total,
        'needs_review', 'pending'
      );
      v_sort := v_sort + 1;
    elsif v_action = 'remove' then
      if v_id is null then raise exception 'Line identity required'; end if;
      select coalesce(sum(c.quantity), 0) into v_claimed
      from public.expense_receipt_line_claims c
      where c.line_item_id = v_id and c.retracted_at is null
        and c.claim_kind in ('mine','assigned','quantity');
      if v_claimed > 0 and not coalesce((v_item->>'removalConfirmed')::boolean, false) then
        raise exception 'CLAIMED_LINE_REMOVAL_REQUIRES_CONFIRMATION';
      end if;
      if v_claimed > 0 then
        update public.expense_receipt_line_claims
        set retracted_at = now()
        where line_item_id = v_id and retracted_at is null;
        perform public._append_receipt_claim_event(
          v_receipt.household_id, p_receipt_id, v_id, v_actor, 'corrected_removed',
          jsonb_build_object('reason', 'repaste')
        );
      end if;
      delete from public.expense_receipt_line_items
      where id = v_id and receipt_id = p_receipt_id;
    end if;
  end loop;

  update public.expense_receipts
  set merchant_corrected = coalesce(p_plan->'header'->>'merchant', merchant_corrected),
      purchase_date_corrected = coalesce((p_plan->'header'->>'purchaseDate')::date, purchase_date_corrected),
      declared_total_cents = coalesce((p_plan->'header'->>'totalCents')::int, declared_total_cents),
      financial_review_required = v_financial,
      last_repaste_idempotency_key = p_idempotency_key,
      status = case
        when status = 'claiming' then 'claiming'
        when status = 'ready_for_review' and not v_financial then 'ready_for_review'
        else 'needs_review'
      end,
      updated_at = now()
  where id = p_receipt_id;

  perform public._receipt_insert_transcription_revision(
    p_receipt_id,
    v_receipt.household_id,
    p_source_text,
    coalesce(p_parsed_payload, '{}'::jsonb),
    coalesce(p_reason, 'user_repaste'),
    v_actor
  );

  insert into public.audit_events (
    household_id, actor_user_id, entity_type, entity_id, event_type, after_state
  ) values (
    v_receipt.household_id, auth.uid(), 'expense_receipt', p_receipt_id, 'receipt.repasted',
    jsonb_build_object('financial_review_required', v_financial, 'notify', v_notify)
  );

  if v_notify then
    select coalesce(array_agg(distinct u), '{}'::uuid[])
    into v_recipients
    from (
      select m.user_id as u
      from public.expense_receipt_line_claims c
      join public.household_memberships m on m.id = c.membership_id
      where c.receipt_id = p_receipt_id
        and c.retracted_at is null
        and m.user_id is distinct from auth.uid()
      union
      select m.user_id
      from public.expense_receipt_claim_invites i
      join public.household_memberships m on m.id = i.membership_id
      where i.receipt_id = p_receipt_id
        and i.status = 'waiting'
        and m.user_id is distinct from auth.uid()
    ) recipients;
    v_merchant := coalesce(nullif(v_receipt.merchant_corrected, ''), 'Receipt');
    if coalesce(array_length(v_recipients, 1), 0) > 0 then
      perform public._emit_notification_event(
        v_receipt.household_id,
        'receipt.updated',
        'expense_receipt',
        p_receipt_id,
        v_actor,
        jsonb_build_object('merchant', left(v_merchant, 80)),
        'receipt.updated:' || p_receipt_id::text || ':' || p_idempotency_key,
        v_recipients,
        'Receipt was updated',
        'A pasted receipt was corrected. Review your items if anything looks different.',
        '/app/' || v_receipt.household_id::text || '/money/receipts/' || p_receipt_id::text
      );
    end if;
  end if;

  return p_receipt_id;
end;
$$;

create or replace function public.acknowledge_receipt_correction(p_receipt_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt public.expense_receipts%rowtype;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_receipt from public.expense_receipts where id = p_receipt_id for update;
  if not found then raise exception 'Receipt not found'; end if;
  if not public.can_edit_expense_receipt(p_receipt_id) then
    raise exception 'Not authorized';
  end if;
  if v_receipt.status = 'confirmed' then
    raise exception 'RECEIPT_ALREADY_CONFIRMED';
  end if;

  update public.expense_receipt_line_items li
  set claim_review_required = false,
      updated_at = now()
  where li.receipt_id = p_receipt_id
    and li.claim_review_required
    and public._receipt_claimed_quantity(li.id) <= public._receipt_line_quantity(li.quantity);

  if exists (
    select 1 from public.expense_receipt_line_items
    where receipt_id = p_receipt_id and claim_review_required
  ) then
    raise exception 'RECEIPT_CLAIM_REVIEW_REQUIRED';
  end if;

  update public.expense_receipts
  set financial_review_required = false,
      updated_at = now()
  where id = p_receipt_id;
end;
$$;

create or replace function public._receipt_guard_confirm()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    if new.financial_review_required then
      raise exception 'RECEIPT_FINANCIAL_REVIEW_REQUIRED';
    end if;
    if exists (
      select 1 from public.expense_receipt_line_items
      where receipt_id = new.id and claim_review_required
    ) then
      raise exception 'RECEIPT_CLAIM_REVIEW_REQUIRED';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists expense_receipts_guard_confirm on public.expense_receipts;
create trigger expense_receipts_guard_confirm
  before update on public.expense_receipts
  for each row execute function public._receipt_guard_confirm();

create or replace function public.claim_receipt_line_quantity(
  p_line_item_id uuid,
  p_quantity numeric,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line public.expense_receipt_line_items%rowtype;
  v_receipt public.expense_receipts%rowtype;
  v_actor uuid;
  v_existing uuid;
  v_blocker uuid;
  v_total numeric;
  v_used numeric;
  v_qty numeric;
  v_id uuid;
  v_payer uuid;
  v_receipt_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  v_qty := public._receipt_line_quantity(p_quantity);

  if p_idempotency_key is not null and length(trim(p_idempotency_key)) >= 8 then
    select id into v_existing
    from public.expense_receipt_line_claims
    where idempotency_key = p_idempotency_key;
    if v_existing is not null then
      return v_existing;
    end if;
  end if;

  select receipt_id into v_receipt_id
  from public.expense_receipt_line_items
  where id = p_line_item_id;
  if not found then raise exception 'Line not found'; end if;

  select * into v_receipt
  from public.expense_receipts
  where id = v_receipt_id
  for update;
  if not found or v_receipt.deleted_at is not null then
    raise exception 'Receipt not found';
  end if;

  select * into v_line
  from public.expense_receipt_line_items
  where id = p_line_item_id
  for update;
  if not found then raise exception 'Line not found'; end if;
  if v_line.claim_review_required then
    raise exception 'CLAIM_NEEDS_REVIEW';
  end if;

  if v_receipt.status = 'confirmed' then
    raise exception 'CLAIM_FINALIZED';
  end if;
  if not public.can_claim_expense_receipt(v_receipt.id)
     and not public.can_edit_expense_receipt(v_receipt.id) then
    raise exception 'Not authorized to claim this receipt';
  end if;
  if v_receipt.status not in ('claiming','needs_review','ready_for_review') then
    raise exception 'CLAIM_NOT_OPEN';
  end if;

  v_actor := public.current_membership_id(v_receipt.household_id);
  if v_actor is null then raise exception 'Not an active household member'; end if;
  if v_receipt.household_id is distinct from v_line.household_id then
    raise exception 'Cross-household mutation rejected';
  end if;

  v_total := public._receipt_line_quantity(v_line.quantity);
  v_used := public._receipt_claimed_quantity(p_line_item_id)
    - coalesce((
        select c.quantity
        from public.expense_receipt_line_claims c
        where c.line_item_id = p_line_item_id
          and c.membership_id = v_actor
          and c.retracted_at is null
      ), 0);

  if v_total = 1 then
    select c.membership_id into v_blocker
    from public.expense_receipt_line_claims c
    where c.line_item_id = p_line_item_id
      and c.retracted_at is null
      and c.membership_id is distinct from v_actor
      and c.claim_kind in ('mine','assigned','quantity')
    limit 1;
    if v_blocker is not null then
      raise exception 'CLAIM_CONFLICT:%', v_blocker;
    end if;
  end if;

  if v_used + v_qty > v_total then
    raise exception 'CLAIM_OVERCLAIM:%', greatest(v_total - v_used, 0);
  end if;

  update public.expense_receipt_line_claims
  set retracted_at = now()
  where line_item_id = p_line_item_id
    and membership_id = v_actor
    and retracted_at is null;

  insert into public.expense_receipt_line_claims (
    household_id, receipt_id, line_item_id, membership_id, claim_kind, quantity,
    idempotency_key
  ) values (
    v_receipt.household_id, v_receipt.id, p_line_item_id, v_actor,
    case when v_qty = v_total then 'mine' else 'quantity' end,
    v_qty,
    nullif(trim(coalesce(p_idempotency_key, '')), '')
  ) returning id into v_id;

  v_payer := coalesce(v_receipt.payer_membership_id, v_receipt.uploaded_by_membership_id);
  if v_total = 1 or v_used + v_qty >= v_total then
    update public.expense_receipt_line_items
    set classification = case
          when v_actor = v_payer and v_total = 1 then 'personal_purchaser'
          when v_total = 1 then 'personal_other'
          else 'shared_selected'
        end,
        participant_membership_ids = case
          when v_total = 1 then array[v_actor]
          else (
            select coalesce(array_agg(c.membership_id), '{}'::uuid[])
            from public.expense_receipt_line_claims c
            where c.line_item_id = p_line_item_id and c.retracted_at is null
          )
        end,
        review_status = 'corrected',
        updated_at = now()
    where id = p_line_item_id;
  end if;

  perform public._append_receipt_claim_event(
    v_receipt.household_id, v_receipt.id, p_line_item_id, v_actor, 'claimed',
    jsonb_build_object('quantity', v_qty)
  );

  return v_id;
exception
  when unique_violation then
    raise exception 'CLAIM_CONFLICT';
end;
$$;

revoke all on function public._receipt_pasted_display_name(text, text) from public;
revoke all on function public._receipt_insert_transcription_revision(uuid, uuid, text, jsonb, text, uuid) from public;
revoke all on function public.apply_receipt_repaste(uuid, text, jsonb, jsonb, text, text) from public;
revoke all on function public.acknowledge_receipt_correction(uuid) from public;
grant execute on function public.apply_receipt_repaste(uuid, text, jsonb, jsonb, text, text) to authenticated;
grant execute on function public.acknowledge_receipt_correction(uuid) to authenticated;
grant execute on function public.submit_client_receipt_extraction(
  uuid, text, numeric, jsonb, text, jsonb, text, jsonb, jsonb, text, jsonb, uuid, uuid
) to authenticated;
grant execute on function public.update_receipt_review(uuid, text, date, int, text, text, jsonb) to authenticated;
grant execute on function public.claim_receipt_line_quantity(uuid, numeric, text) to authenticated;
