-- Receipt → expense handoff repair.
--
-- The original confirm_receipt_as_expense created line items but never the
-- allocation inputs they depend on, so imported drafts could not reconcile:
--   * 'personal' items had no personal_membership_id
--   * 'equal_selected' items had no expense_item_allocations rows
--   * excluded lines were skipped, so their amount left the receipt total
--   * tax and tip from extraction were dropped entirely
--
-- This version fills those in from the reviewed receipt, and maps any
-- remaining gap between the line items and the declared total to tax/tip
-- adjustments — capped so it can never exceed the declared total.

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
  v_personal_id uuid;
  v_participants uuid[];
  v_participant uuid;
  v_item_total int;
  v_item_subtotal int := 0;
  v_proposed jsonb;
  v_remaining int;
  v_tax int;
  v_tip int;
  v_adjustments int := 0;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_idempotency_key is null or char_length(trim(p_idempotency_key)) < 8 then
    raise exception 'Idempotency key required';
  end if;

  select * into v_receipt from public.expense_receipts where id = p_receipt_id for update;
  if not found or v_receipt.deleted_at is not null then
    raise exception 'Receipt not found';
  end if;
  if not public.can_edit_expense_receipt(p_receipt_id) then
    raise exception 'Not authorized to confirm this receipt';
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

  -- Excluded lines are imported too: they are part of what the receipt
  -- charged, they just never create a reimbursement.
  for v_item in
    select * from public.expense_receipt_line_items
    where receipt_id = p_receipt_id
    order by sort_index
  loop
    -- Only participants who are still active members of this household.
    select coalesce(array_agg(m.id), '{}'::uuid[])
    into v_participants
    from unnest(coalesce(v_item.participant_membership_ids, '{}'::uuid[])) as p(id)
    join public.household_memberships m
      on m.id = p.id
     and m.household_id = v_receipt.household_id
     and m.status = 'active';

    v_personal_id := null;
    v_mode := case v_item.classification
      when 'personal_purchaser' then 'personal'
      when 'personal_other' then 'personal'
      when 'shared_selected' then 'equal_selected'
      when 'excluded' then 'excluded'
      else 'equal_all'
    end;

    if v_mode = 'personal' then
      if v_item.classification = 'personal_purchaser' then
        v_personal_id := v_receipt.uploaded_by_membership_id;
      elsif array_length(v_participants, 1) >= 1 then
        v_personal_id := v_participants[1];
      end if;
      -- A 'personal_other' line with nobody chosen stays unassigned on
      -- purpose: the draft editor asks who owns it rather than guessing.
    elsif v_mode = 'equal_selected' and coalesce(array_length(v_participants, 1), 0) = 0 then
      -- Marked shared but nobody selected: treat as shared with everyone.
      v_mode := 'equal_all';
    end if;

    v_item_total := coalesce(v_item.total_price_cents, v_item.unit_price_cents, 0);
    v_item_subtotal := v_item_subtotal + v_item_total;

    insert into public.expense_items (
      expense_id, household_id, description, total_cents,
      allocation_mode, personal_membership_id, classification,
      display_order, quantity_label
    ) values (
      v_expense_id, v_receipt.household_id,
      coalesce(v_item.corrected_name, v_item.ocr_text, 'Item'),
      v_item_total,
      v_mode,
      v_personal_id,
      v_item.classification,
      v_item.sort_index,
      case when v_item.quantity is null then null else v_item.quantity::text end
    ) returning id into v_expense_item_id;

    if v_mode = 'personal' and v_personal_id is not null then
      insert into public.expense_item_allocations (
        item_id, expense_id, household_id, membership_id, amount_cents
      ) values (
        v_expense_item_id, v_expense_id, v_receipt.household_id, v_personal_id, 0
      )
      on conflict (item_id, membership_id) do nothing;
    elsif v_mode = 'equal_selected' then
      foreach v_participant in array v_participants
      loop
        insert into public.expense_item_allocations (
          item_id, expense_id, household_id, membership_id, amount_cents
        ) values (
          v_expense_item_id, v_expense_id, v_receipt.household_id, v_participant, 0
        )
        on conflict (item_id, membership_id) do nothing;
      end loop;
    end if;

    update public.expense_receipt_line_items
    set expense_item_id = v_expense_item_id
    where id = v_item.id;
  end loop;

  -- Map extracted tax and tip into adjustments, never beyond the gap between
  -- the line items and the declared total.
  select e.proposed into v_proposed
  from public.expense_receipt_extractions e
  where e.receipt_id = p_receipt_id
  order by e.created_at desc
  limit 1;

  v_remaining := coalesce(v_receipt.declared_total_cents, 0) - v_item_subtotal;
  v_tax := greatest(coalesce((v_proposed->>'taxCents')::int, 0), 0);
  v_tip := greatest(coalesce((v_proposed->>'tipCents')::int, 0), 0);

  if v_remaining > 0 and v_tax > 0 then
    v_tax := least(v_tax, v_remaining);
    insert into public.expense_adjustments (
      expense_id, household_id, adjustment_type, description,
      amount_cents, allocation_mode, display_order
    ) values (
      v_expense_id, v_receipt.household_id, 'tax', 'Tax',
      v_tax, 'proportional', 0
    );
    v_remaining := v_remaining - v_tax;
    v_adjustments := v_adjustments + v_tax;
  end if;

  if v_remaining > 0 and v_tip > 0 then
    v_tip := least(v_tip, v_remaining);
    insert into public.expense_adjustments (
      expense_id, household_id, adjustment_type, description,
      amount_cents, allocation_mode, display_order
    ) values (
      v_expense_id, v_receipt.household_id, 'tip', 'Tip',
      v_tip, 'proportional', 1
    );
    v_adjustments := v_adjustments + v_tip;
  end if;

  update public.expenses
  set calculated_subtotal_cents = v_item_subtotal,
      calculated_adjustments_cents = v_adjustments
  where id = v_expense_id;

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
    jsonb_build_object(
      'expense_id', v_expense_id,
      'item_subtotal_cents', v_item_subtotal,
      'adjustments_cents', v_adjustments
    )
  );

  return v_expense_id;
end;
$$;
