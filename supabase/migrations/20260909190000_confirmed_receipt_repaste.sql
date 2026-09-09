-- Re-paste after a receipt is confirmed starts an expense correction.
-- Original confirmed expense and receipt line items stay on record.

create or replace function public.apply_confirmed_receipt_repaste(
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
  v_original public.expenses%rowtype;
  v_amendment public.expenses%rowtype;
  v_item jsonb;
  v_action text;
  v_id uuid;
  v_sort int := 0;
  v_qty numeric;
  v_total int;
  v_name text;
  v_source text;
  v_claimed numeric;
  v_source_item_id uuid;
  v_new_item_id uuid;
  v_template public.expense_items%rowtype;
  v_item_row public.expense_items%rowtype;
  v_alloc record;
  v_adj record;
  v_new_adj_id uuid;
  v_amount int;
  v_header jsonb;
  v_tax int;
  v_tip int;
  v_fee int;
  v_discount int;
  v_has_tax boolean := false;
  v_has_tip boolean := false;
  v_has_fee boolean := false;
  v_has_discount boolean := false;
  v_subtotal int := 0;
  v_adjustments int := 0;
  v_draft_id uuid;
  v_live_id uuid;
  v_next uuid;
  v_status text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_idempotency_key is null or char_length(trim(p_idempotency_key)) < 8 then
    raise exception 'Idempotency key required';
  end if;
  if coalesce(p_reason, 'user_repaste') not in ('initial_paste', 'user_repaste') then
    raise exception 'Invalid revision reason';
  end if;

  perform set_config('householdos.expense_mutation', 'rpc', true);

  select * into v_receipt from public.expense_receipts where id = p_receipt_id for update;
  if not found or v_receipt.deleted_at is not null then
    raise exception 'Receipt not found';
  end if;
  if not public.can_edit_expense_receipt(p_receipt_id) then
    raise exception 'Not authorized to edit this receipt';
  end if;
  if v_receipt.status is distinct from 'confirmed' then
    raise exception 'RECEIPT_NOT_CONFIRMED';
  end if;
  if v_receipt.expense_id is null then
    raise exception 'Receipt has no linked expense';
  end if;

  v_live_id := v_receipt.expense_id;
  loop
    select superseded_by_expense_id, status
      into v_next, v_status
    from public.expenses
    where id = v_live_id;
    if not found then
      raise exception 'Expense not found';
    end if;
    exit when v_next is null or v_status = 'draft';
    select status into v_status from public.expenses where id = v_next;
    exit when v_status is distinct from 'confirmed' and v_status is distinct from 'amended';
    v_live_id := v_next;
  end loop;

  select * into v_original from public.expenses where id = v_live_id for update;
  if not found then
    raise exception 'Expense not found';
  end if;

  select a.amendment_expense_id into v_draft_id
  from public.expense_amendments a
  where a.original_expense_id = v_original.id
    and a.status = 'draft'
  limit 1;

  if v_original.status = 'draft' then
    v_amendment := v_original;
    if v_original.supersedes_expense_id is null then
      raise exception 'Only confirmed expenses can be amended';
    end if;
  elsif v_draft_id is not null then
    select * into v_amendment from public.expenses where id = v_draft_id for update;
  else
    if v_original.status is distinct from 'confirmed' then
      raise exception 'Only confirmed expenses can be amended';
    end if;
    if not public.can_confirm_or_void_expense(v_original.id) then
      raise exception 'Not allowed to amend this expense';
    end if;
    select * into v_amendment
    from public.create_expense_amendment(
      v_original.id,
      'Corrected receipt transcription'
    );
  end if;

  if v_amendment.status is distinct from 'draft' then
    raise exception 'Correction draft is not editable';
  end if;
  if not public.can_confirm_or_void_expense(coalesce(v_amendment.supersedes_expense_id, v_original.id)) then
    raise exception 'Not allowed to amend this expense';
  end if;

  if v_receipt.last_repaste_idempotency_key is not null
     and v_receipt.last_repaste_idempotency_key = p_idempotency_key then
    return v_amendment.id;
  end if;

  perform id from public.expense_receipt_line_items
  where receipt_id = p_receipt_id
  order by id
  for update;

  for v_item in select * from jsonb_array_elements(coalesce(p_plan->'lines', '[]'::jsonb))
  loop
    v_action := v_item->>'action';
    v_id := nullif(btrim(v_item->>'id'), '')::uuid;
    if v_action = 'remove' then
      if v_id is null then raise exception 'Line identity required'; end if;
      select coalesce(sum(c.quantity), 0) into v_claimed
      from public.expense_receipt_line_claims c
      where c.line_item_id = v_id and c.retracted_at is null
        and c.claim_kind in ('mine','assigned','quantity');
      if v_claimed > 0 and not coalesce((v_item->>'removalConfirmed')::boolean, false) then
        raise exception 'CLAIMED_LINE_REMOVAL_REQUIRES_CONFIRMATION';
      end if;
    end if;
  end loop;

  delete from public.expense_items where expense_id = v_amendment.id;
  delete from public.expense_adjustments where expense_id = v_amendment.id;

  select * into v_template
  from public.expense_items
  where expense_id = coalesce(v_amendment.supersedes_expense_id, v_original.id)
  order by display_order
  limit 1;

  v_header := coalesce(p_plan->'header', '{}'::jsonb);

  for v_item in select * from jsonb_array_elements(coalesce(p_plan->'lines', '[]'::jsonb))
  loop
    v_action := v_item->>'action';
    if v_action = 'remove' then
      continue;
    end if;

    v_id := nullif(btrim(v_item->>'id'), '')::uuid;
    v_source := left(coalesce(v_item->>'sourceText', ''), 2000);
    v_name := public._receipt_pasted_display_name(v_item->>'displayDescription', v_source);
    v_qty := coalesce(nullif(v_item->>'quantity', '')::numeric, 1);
    v_total := coalesce(nullif(v_item->>'totalCents', '')::int, 0);
    v_source_item_id := null;
    v_item_row := v_template;

    if v_id is not null then
      select li.expense_item_id into v_source_item_id
      from public.expense_receipt_line_items li
      where li.id = v_id and li.receipt_id = p_receipt_id;
    end if;

    if v_source_item_id is not null then
      select * into v_item_row
      from public.expense_items
      where id = v_source_item_id;
      if not found then
        v_item_row := v_template;
      end if;
    end if;

    insert into public.expense_items (
      expense_id, household_id, description, quantity_label, total_cents,
      display_order, allocation_mode, personal_membership_id,
      exclude_from_adjustment_basis, classification
    ) values (
      v_amendment.id,
      v_amendment.household_id,
      coalesce(nullif(btrim(v_name), ''), 'Item'),
      case when v_qty is null then null else v_qty::text end,
      v_total,
      v_sort,
      coalesce(v_item_row.allocation_mode, 'equal_all'),
      v_item_row.personal_membership_id,
      coalesce(v_item_row.exclude_from_adjustment_basis, false),
      v_item_row.classification
    )
    returning id into v_new_item_id;

    if v_item_row.id is not null then
      for v_alloc in
        select * from public.expense_item_allocations where item_id = v_item_row.id
      loop
        insert into public.expense_item_allocations (
          item_id, expense_id, household_id, membership_id,
          amount_cents, fixed_cents, percent_bps, weight
        ) values (
          v_new_item_id, v_amendment.id, v_amendment.household_id, v_alloc.membership_id,
          0, v_alloc.fixed_cents, v_alloc.percent_bps, v_alloc.weight
        );
      end loop;
    end if;

    v_subtotal := v_subtotal + v_total;
    v_sort := v_sort + 1;
  end loop;

  v_tax := nullif(v_header->>'taxCents', '')::int;
  v_tip := nullif(v_header->>'tipCents', '')::int;
  v_fee := nullif(v_header->>'feeCents', '')::int;
  v_discount := nullif(v_header->>'discountCents', '')::int;

  for v_adj in
    select *
    from public.expense_adjustments
    where expense_id = coalesce(v_amendment.supersedes_expense_id, v_original.id)
    order by display_order
  loop
    v_amount := v_adj.amount_cents;
    if v_adj.adjustment_type = 'tax' then
      v_has_tax := true;
      if v_tax is not null then v_amount := v_tax; end if;
    elsif v_adj.adjustment_type = 'tip' then
      v_has_tip := true;
      if v_tip is not null then v_amount := v_tip; end if;
    elsif v_adj.adjustment_type in ('service_fee', 'delivery_fee') then
      v_has_fee := true;
      if v_fee is not null then v_amount := v_fee; end if;
    elsif v_adj.adjustment_type in ('discount', 'coupon') then
      v_has_discount := true;
      if v_discount is not null then v_amount := -abs(v_discount); end if;
    end if;
    if v_amount = 0 then
      continue;
    end if;

    insert into public.expense_adjustments (
      expense_id, household_id, adjustment_type, description, amount_cents,
      allocation_mode, assigned_membership_id, display_order
    ) values (
      v_amendment.id, v_amendment.household_id, v_adj.adjustment_type, v_adj.description,
      v_amount, v_adj.allocation_mode, v_adj.assigned_membership_id, v_adj.display_order
    )
    returning id into v_new_adj_id;

    for v_alloc in
      select * from public.expense_adjustment_allocations where adjustment_id = v_adj.id
    loop
      insert into public.expense_adjustment_allocations (
        adjustment_id, expense_id, household_id, membership_id,
        amount_cents, fixed_cents, percent_bps, weight
      ) values (
        v_new_adj_id, v_amendment.id, v_amendment.household_id, v_alloc.membership_id,
        0, v_alloc.fixed_cents, v_alloc.percent_bps, v_alloc.weight
      );
    end loop;

    v_adjustments := v_adjustments + v_amount;
  end loop;

  if v_tax is not null and v_tax <> 0 and not v_has_tax then
    insert into public.expense_adjustments (
      expense_id, household_id, adjustment_type, description, amount_cents,
      allocation_mode, display_order
    ) values (
      v_amendment.id, v_amendment.household_id, 'tax', 'Tax', v_tax, 'proportional', 100
    );
    v_adjustments := v_adjustments + v_tax;
  end if;
  if v_tip is not null and v_tip <> 0 and not v_has_tip then
    insert into public.expense_adjustments (
      expense_id, household_id, adjustment_type, description, amount_cents,
      allocation_mode, display_order
    ) values (
      v_amendment.id, v_amendment.household_id, 'tip', 'Tip', v_tip, 'proportional', 101
    );
    v_adjustments := v_adjustments + v_tip;
  end if;
  if v_fee is not null and v_fee <> 0 and not v_has_fee then
    insert into public.expense_adjustments (
      expense_id, household_id, adjustment_type, description, amount_cents,
      allocation_mode, display_order
    ) values (
      v_amendment.id, v_amendment.household_id, 'service_fee', 'Fee', v_fee, 'proportional', 102
    );
    v_adjustments := v_adjustments + v_fee;
  end if;
  if v_discount is not null and v_discount <> 0 and not v_has_discount then
    insert into public.expense_adjustments (
      expense_id, household_id, adjustment_type, description, amount_cents,
      allocation_mode, display_order
    ) values (
      v_amendment.id, v_amendment.household_id, 'discount', 'Discount',
      -abs(v_discount), 'proportional', 103
    );
    v_adjustments := v_adjustments - abs(v_discount);
  end if;

  update public.expenses
  set merchant = coalesce(nullif(btrim(v_header->>'merchant'), ''), merchant),
      purchase_date = coalesce(nullif(v_header->>'purchaseDate', '')::date, purchase_date),
      declared_total_cents = coalesce(nullif(v_header->>'totalCents', '')::int, declared_total_cents),
      calculated_subtotal_cents = v_subtotal,
      calculated_adjustments_cents = v_adjustments,
      updated_at = now()
  where id = v_amendment.id;

  perform public._receipt_insert_transcription_revision(
    p_receipt_id,
    v_receipt.household_id,
    p_source_text,
    coalesce(p_parsed_payload, '{}'::jsonb),
    coalesce(p_reason, 'user_repaste'),
    public.current_membership_id(v_receipt.household_id)
  );

  update public.expense_receipts
  set last_repaste_idempotency_key = p_idempotency_key,
      updated_at = now()
  where id = p_receipt_id;

  insert into public.audit_events (
    household_id, actor_user_id, entity_type, entity_id, event_type, after_state, reason
  ) values (
    v_receipt.household_id,
    auth.uid(),
    'expense_receipt',
    p_receipt_id,
    'receipt.repasted',
    jsonb_build_object(
      'amendment_expense_id', v_amendment.id,
      'original_expense_id', coalesce(v_amendment.supersedes_expense_id, v_original.id)
    ),
    'Corrected receipt transcription'
  );

  return v_amendment.id;
end;
$$;

revoke all on function public.apply_confirmed_receipt_repaste(uuid, text, jsonb, jsonb, text, text) from public;
grant execute on function public.apply_confirmed_receipt_repaste(uuid, text, jsonb, jsonb, text, text) to authenticated;
