-- Completion-C: receipt line destination apply lifecycle

alter table public.expense_receipt_line_items
  add column if not exists destination_apply_status text not null default 'proposed'
    check (destination_apply_status in (
      'proposed','applied','failed','skipped','reversed'
    ));

alter table public.expense_receipt_line_items
  add column if not exists destination_resource_id uuid;

alter table public.expense_receipt_line_items
  add column if not exists destination_apply_error text;

alter table public.expense_receipt_line_items
  add column if not exists destination_applied_at timestamptz;

create or replace function public.apply_receipt_line_destinations(p_receipt_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt public.expense_receipts%rowtype;
  v_item public.expense_receipt_line_items%rowtype;
  v_name text;
  v_resource_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_receipt from public.expense_receipts where id = p_receipt_id for update;
  if not found or v_receipt.deleted_at is not null then
    raise exception 'Receipt not found';
  end if;
  if not public.can_edit_expense_receipt(p_receipt_id) then
    raise exception 'Not authorized';
  end if;
  if v_receipt.status <> 'confirmed' then
    raise exception 'Confirm receipt before applying destinations';
  end if;

  perform set_config('householdos.resource_mutation', 'rpc', true);

  for v_item in
    select * from public.expense_receipt_line_items
    where receipt_id = p_receipt_id
      and destination_apply_status = 'proposed'
      and review_status <> 'excluded'
    order by sort_index
    for update
  loop
    v_name := coalesce(nullif(trim(v_item.corrected_name), ''), nullif(trim(v_item.ocr_text), ''), 'Item');
    v_resource_id := null;

    begin
      if v_item.resource_destination in ('none', 'do_not_track') then
        update public.expense_receipt_line_items
        set destination_apply_status = 'skipped',
            destination_applied_at = now(),
            updated_at = now()
        where id = v_item.id;
        continue;
      end if;

      if v_item.resource_destination = 'pantry_add' then
        v_resource_id := public.create_pantry_item(
          p_household_id := v_receipt.household_id,
          p_name := v_name,
          p_category := 'other',
          p_visibility := 'household',
          p_quantity_unit := 'item',
          p_notes := 'From receipt'
        );
      elsif v_item.resource_destination = 'supply_add' then
        v_resource_id := public.create_supply_item(
          p_household_id := v_receipt.household_id,
          p_name := v_name,
          p_category := 'other',
          p_quantity := coalesce(v_item.quantity, 1),
          p_quantity_unit := 'item',
          p_notes := 'From receipt'
        );
      elsif v_item.resource_destination = 'inventory_add' then
        v_resource_id := public.create_inventory_item(
          p_household_id := v_receipt.household_id,
          p_name := v_name,
          p_category := 'other',
          p_condition := 'unknown',
          p_description := 'From receipt'
        );
      elsif v_item.resource_destination = 'shopping_complete' then
        select s.id into v_resource_id
        from public.shopping_list_items s
        where s.household_id = v_receipt.household_id
          and s.status in ('open', 'needed', 'active')
          and lower(s.name) = lower(v_name)
        order by s.created_at desc
        limit 1;
        if v_resource_id is null then
          update public.expense_receipt_line_items
          set destination_apply_status = 'skipped',
              destination_apply_error = 'No matching open shopping item',
              destination_applied_at = now(),
              updated_at = now()
          where id = v_item.id;
          continue;
        end if;
        perform public.mark_shopping_item_purchased(p_item_id := v_resource_id);
      elsif v_item.resource_destination in ('pantry_restock', 'supply_restock') then
        update public.expense_receipt_line_items
        set destination_apply_status = 'skipped',
            destination_apply_error = 'Restock requires an existing item selection',
            destination_applied_at = now(),
            updated_at = now()
        where id = v_item.id;
        continue;
      else
        update public.expense_receipt_line_items
        set destination_apply_status = 'skipped',
            destination_applied_at = now(),
            updated_at = now()
        where id = v_item.id;
        continue;
      end if;

      update public.expense_receipt_line_items
      set destination_apply_status = 'applied',
          destination_resource_id = v_resource_id,
          destination_apply_error = null,
          destination_applied_at = now(),
          updated_at = now()
      where id = v_item.id;
    exception when others then
      update public.expense_receipt_line_items
      set destination_apply_status = 'failed',
          destination_apply_error = left(SQLERRM, 500),
          destination_applied_at = now(),
          updated_at = now()
      where id = v_item.id;
    end;
  end loop;
end;
$$;

revoke all on function public.apply_receipt_line_destinations(uuid) from public;
grant execute on function public.apply_receipt_line_destinations(uuid) to authenticated;

create or replace function public.reverse_receipt_destination_applies(p_receipt_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select household_id into v_household_id from public.expense_receipts where id = p_receipt_id;
  if v_household_id is null then raise exception 'Receipt not found'; end if;
  if not public.can_edit_expense_receipt(p_receipt_id)
     and not public._is_financial_coordinator(v_household_id) then
    raise exception 'Not authorized';
  end if;
  -- Soft reverse only — do not delete physical pantry/supply/inventory rows
  update public.expense_receipt_line_items
  set destination_apply_status = 'reversed',
      updated_at = now()
  where receipt_id = p_receipt_id
    and destination_apply_status = 'applied';
end;
$$;

revoke all on function public.reverse_receipt_destination_applies(uuid) from public;
grant execute on function public.reverse_receipt_destination_applies(uuid) to authenticated;
