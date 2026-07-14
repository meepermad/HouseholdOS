-- Phase 2: expense confirmation, void, amendment RPCs + audit allowlist

create or replace function public.write_audit_event(
  p_household_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_event_type text,
  p_before_state jsonb default null,
  p_after_state jsonb default null,
  p_reason text default null,
  p_correlation_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_allowed text[] := array[
    'household.updated',
    'household.settings_updated',
    'profile.recovered',
    'membership.status_changed',
    'membership.roles_changed',
    'invitation.created',
    'invitation.accepted',
    'invitation.declined',
    'invitation.revoked',
    'household.created',
    'household.archived',
    'expense.created',
    'expense.submitted_for_review',
    'expense.confirmed',
    'expense.amendment_created',
    'expense.amended',
    'expense.voided',
    'expense.draft_deleted',
    'reimbursement.created',
    'reimbursement.adjusted',
    'reimbursement.reversed',
    'reimbursement.waived'
  ];
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_entity_type is null or char_length(trim(p_entity_type)) < 1 then
    raise exception 'Invalid entity type';
  end if;

  if p_entity_id is null then
    raise exception 'Invalid entity id';
  end if;

  if p_event_type is null or not (p_event_type = any (v_allowed)) then
    raise exception 'Event type not permitted';
  end if;

  if p_household_id is not null and not public.is_active_member(p_household_id) then
    raise exception 'Not an active member of this household';
  end if;

  if coalesce(p_before_state::text, '') ~* '(password|token_hash|secret|service_role)'
     or coalesce(p_after_state::text, '') ~* '(password|token_hash|secret|service_role)' then
    raise exception 'Audit payload contains forbidden fields';
  end if;

  insert into public.audit_events (
    household_id,
    actor_user_id,
    entity_type,
    entity_id,
    event_type,
    before_state,
    after_state,
    reason,
    correlation_id
  ) values (
    p_household_id,
    v_user_id,
    p_entity_type,
    p_entity_id,
    p_event_type,
    p_before_state,
    p_after_state,
    p_reason,
    coalesce(p_correlation_id, gen_random_uuid())
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Internal audit insert used inside expense RPCs (already authenticated via auth.uid)
create or replace function public._expense_audit(
  p_household_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_event_type text,
  p_before_state jsonb default null,
  p_after_state jsonb default null,
  p_reason text default null,
  p_correlation_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_events (
    household_id,
    actor_user_id,
    entity_type,
    entity_id,
    event_type,
    before_state,
    after_state,
    reason,
    correlation_id
  ) values (
    p_household_id,
    auth.uid(),
    p_entity_type,
    p_entity_id,
    p_event_type,
    p_before_state,
    p_after_state,
    p_reason,
    coalesce(p_correlation_id, gen_random_uuid())
  );
end;
$$;

revoke all on function public._expense_audit(uuid, text, uuid, text, jsonb, jsonb, text, uuid) from public;

create or replace function public.can_confirm_or_void_expense(p_expense_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.expenses e
    where e.id = p_expense_id
      and public.is_active_member(e.household_id)
      and (
        e.created_by_membership_id = public.current_membership_id(e.household_id)
        or e.payer_membership_id = public.current_membership_id(e.household_id)
        or public.has_responsibility(
          e.household_id,
          array['financial_coordinator']
        )
      )
  );
$$;

revoke all on function public.can_confirm_or_void_expense(uuid) from public;
grant execute on function public.can_confirm_or_void_expense(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- confirm_expense
-- snapshot shape (server-recomputed only):
-- {
--   calculated_subtotal_cents, calculated_adjustments_cents,
--   item_allocations: [{item_id, membership_id, amount_cents}],
--   adjustment_allocations: [{adjustment_id, membership_id, amount_cents}],
--   obligations: [{debtor_membership_id, creditor_membership_id, amount_cents}]
-- }
-- ---------------------------------------------------------------------------
create or replace function public.confirm_expense(
  p_expense_id uuid,
  p_idempotency_key text,
  p_snapshot jsonb
)
returns public.expenses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_expense public.expenses%rowtype;
  v_membership_id uuid;
  v_item_subtotal integer;
  v_adj_net integer;
  v_corr uuid := gen_random_uuid();
  v_item record;
  v_adj record;
  v_alloc jsonb;
  v_obl jsonb;
  v_sum integer;
  v_debtor uuid;
  v_creditor uuid;
  v_amount integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_idempotency_key is null or char_length(trim(p_idempotency_key)) < 8 then
    raise exception 'Idempotency key required';
  end if;

  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' then
    raise exception 'Confirmation snapshot required';
  end if;

  perform set_config('householdos.expense_mutation', 'rpc', true);

  select * into v_expense
  from public.expenses e
  where e.id = p_expense_id
  for update;

  if not found then
    raise exception 'Expense not found';
  end if;

  -- Idempotent short-circuit
  if v_expense.status = 'confirmed'
     and v_expense.confirmation_idempotency_key = p_idempotency_key then
    return v_expense;
  end if;

  if v_expense.status = 'confirmed' then
    raise exception 'Expense already confirmed';
  end if;

  if v_expense.status not in ('draft', 'ready_for_review') then
    raise exception 'Expense cannot be confirmed from status %', v_expense.status;
  end if;

  if not public.can_confirm_or_void_expense(p_expense_id) then
    raise exception 'Not allowed to confirm this expense';
  end if;

  v_membership_id := public.current_membership_id(v_expense.household_id);

  -- Recompute totals from stored items/adjustments (authoritative line totals)
  select coalesce(sum(total_cents), 0) into v_item_subtotal
  from public.expense_items where expense_id = p_expense_id;

  select coalesce(sum(amount_cents), 0) into v_adj_net
  from public.expense_adjustments where expense_id = p_expense_id;

  if v_item_subtotal + v_adj_net <> v_expense.declared_total_cents then
    raise exception 'Expense is not reconciled';
  end if;

  if (p_snapshot->>'calculated_subtotal_cents')::integer is distinct from v_item_subtotal then
    raise exception 'Snapshot subtotal mismatch';
  end if;

  if (p_snapshot->>'calculated_adjustments_cents')::integer is distinct from v_adj_net then
    raise exception 'Snapshot adjustments mismatch';
  end if;

  -- Validate each item allocation set sums to item total (excluded → empty/zero)
  for v_item in
    select * from public.expense_items where expense_id = p_expense_id
  loop
    select coalesce(sum((elem->>'amount_cents')::integer), 0) into v_sum
    from jsonb_array_elements(coalesce(p_snapshot->'item_allocations', '[]'::jsonb)) as elem
    where (elem->>'item_id')::uuid = v_item.id;

    if exists (
      select 1
      from jsonb_array_elements(coalesce(p_snapshot->'item_allocations', '[]'::jsonb)) as elem
      where (elem->>'item_id')::uuid = v_item.id
        and not public.membership_belongs_to_household(
          (elem->>'membership_id')::uuid,
          v_expense.household_id
        )
    ) then
      raise exception 'Invalid allocation membership';
    end if;

    if v_item.allocation_mode = 'excluded' then
      if v_sum <> 0 then
        raise exception 'Excluded item must have zero allocations';
      end if;
    elsif v_sum <> v_item.total_cents then
      raise exception 'Item allocation sum mismatch';
    end if;
  end loop;

  for v_adj in
    select * from public.expense_adjustments where expense_id = p_expense_id
  loop
    select coalesce(sum((elem->>'amount_cents')::integer), 0) into v_sum
    from jsonb_array_elements(coalesce(p_snapshot->'adjustment_allocations', '[]'::jsonb)) as elem
    where (elem->>'adjustment_id')::uuid = v_adj.id;

    if exists (
      select 1
      from jsonb_array_elements(coalesce(p_snapshot->'adjustment_allocations', '[]'::jsonb)) as elem
      where (elem->>'adjustment_id')::uuid = v_adj.id
        and not public.membership_belongs_to_household(
          (elem->>'membership_id')::uuid,
          v_expense.household_id
        )
    ) then
      raise exception 'Invalid adjustment allocation membership';
    end if;

    if v_adj.amount_cents = 0 then
      null;
    elsif v_sum <> v_adj.amount_cents then
      raise exception 'Adjustment allocation sum mismatch';
    end if;
  end loop;

  -- Persist computed item allocation amounts
  for v_alloc in
    select value from jsonb_array_elements(coalesce(p_snapshot->'item_allocations', '[]'::jsonb)) as t(value)
  loop
    insert into public.expense_item_allocations (
      item_id, expense_id, household_id, membership_id, amount_cents
    ) values (
      (v_alloc->>'item_id')::uuid,
      p_expense_id,
      v_expense.household_id,
      (v_alloc->>'membership_id')::uuid,
      (v_alloc->>'amount_cents')::integer
    )
    on conflict (item_id, membership_id) do update
      set amount_cents = excluded.amount_cents,
          updated_at = now();
  end loop;

  for v_alloc in
    select value from jsonb_array_elements(coalesce(p_snapshot->'adjustment_allocations', '[]'::jsonb)) as t(value)
  loop
    insert into public.expense_adjustment_allocations (
      adjustment_id, expense_id, household_id, membership_id, amount_cents
    ) values (
      (v_alloc->>'adjustment_id')::uuid,
      p_expense_id,
      v_expense.household_id,
      (v_alloc->>'membership_id')::uuid,
      (v_alloc->>'amount_cents')::integer
    )
    on conflict (adjustment_id, membership_id) do update
      set amount_cents = excluded.amount_cents,
          updated_at = now();
  end loop;

  -- Create obligations
  for v_obl in
    select value from jsonb_array_elements(coalesce(p_snapshot->'obligations', '[]'::jsonb)) as t(value)
  loop
    v_debtor := (v_obl->>'debtor_membership_id')::uuid;
    v_creditor := (v_obl->>'creditor_membership_id')::uuid;
    v_amount := (v_obl->>'amount_cents')::integer;

    if v_debtor = v_creditor then
      raise exception 'Self-reimbursement obligation is not allowed';
    end if;
    if v_amount is null or v_amount <= 0 then
      raise exception 'Obligation amount must be positive';
    end if;
    if not public.membership_belongs_to_household(v_debtor, v_expense.household_id)
       or not public.membership_belongs_to_household(v_creditor, v_expense.household_id) then
      raise exception 'Obligation memberships must belong to household';
    end if;

    insert into public.reimbursement_obligations (
      household_id,
      expense_id,
      creditor_membership_id,
      debtor_membership_id,
      original_amount_cents,
      current_amount_cents,
      status
    ) values (
      v_expense.household_id,
      p_expense_id,
      v_creditor,
      v_debtor,
      v_amount,
      v_amount,
      'pending'
    );

    perform public._expense_audit(
      v_expense.household_id,
      'reimbursement_obligation',
      (
        select id from public.reimbursement_obligations
        where expense_id = p_expense_id
          and debtor_membership_id = v_debtor
          and creditor_membership_id = v_creditor
      ),
      'reimbursement.created',
      null,
      jsonb_build_object(
        'expense_id', p_expense_id,
        'debtor_membership_id', v_debtor,
        'creditor_membership_id', v_creditor,
        'amount_cents', v_amount
      ),
      null,
      v_corr
    );
  end loop;

  update public.expenses
  set status = 'confirmed',
      confirmed_at = now(),
      confirmed_by_membership_id = v_membership_id,
      calculated_subtotal_cents = v_item_subtotal,
      calculated_adjustments_cents = v_adj_net,
      confirmation_idempotency_key = p_idempotency_key,
      updated_at = now()
  where id = p_expense_id
  returning * into v_expense;

  perform public._expense_audit(
    v_expense.household_id,
    'expense',
    p_expense_id,
    'expense.confirmed',
    jsonb_build_object('status', 'ready_for_review'),
    jsonb_build_object(
      'status', 'confirmed',
      'declared_total_cents', v_expense.declared_total_cents,
      'obligation_count', jsonb_array_length(coalesce(p_snapshot->'obligations', '[]'::jsonb))
    ),
    null,
    v_corr
  );

  return v_expense;
end;
$$;

revoke all on function public.confirm_expense(uuid, text, jsonb) from public;
grant execute on function public.confirm_expense(uuid, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- void_expense
-- ---------------------------------------------------------------------------
create or replace function public.void_expense(
  p_expense_id uuid,
  p_reason text
)
returns public.expenses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_expense public.expenses%rowtype;
  v_corr uuid := gen_random_uuid();
  v_obl record;
  v_rev_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_reason is null or char_length(trim(p_reason)) < 1 then
    raise exception 'Void reason required';
  end if;

  perform set_config('householdos.expense_mutation', 'rpc', true);

  select * into v_expense
  from public.expenses e
  where e.id = p_expense_id
  for update;

  if not found then
    raise exception 'Expense not found';
  end if;

  if v_expense.status = 'voided' then
    return v_expense;
  end if;

  if v_expense.status <> 'confirmed' then
    raise exception 'Only confirmed expenses can be voided';
  end if;

  if not public.can_confirm_or_void_expense(p_expense_id) then
    raise exception 'Not allowed to void this expense';
  end if;

  for v_obl in
    select * from public.reimbursement_obligations
    where expense_id = p_expense_id
      and status = 'pending'
    for update
  loop
    update public.reimbursement_obligations
    set status = 'reversed',
        current_amount_cents = 0,
        updated_at = now()
    where id = v_obl.id;

    perform public._expense_audit(
      v_expense.household_id,
      'reimbursement_obligation',
      v_obl.id,
      'reimbursement.reversed',
      jsonb_build_object('status', 'pending', 'amount_cents', v_obl.current_amount_cents),
      jsonb_build_object('status', 'reversed', 'amount_cents', 0),
      p_reason,
      v_corr
    );
  end loop;

  update public.expenses
  set status = 'voided',
      voided_at = now(),
      void_reason = trim(p_reason),
      updated_at = now()
  where id = p_expense_id
  returning * into v_expense;

  perform public._expense_audit(
    v_expense.household_id,
    'expense',
    p_expense_id,
    'expense.voided',
    jsonb_build_object('status', 'confirmed'),
    jsonb_build_object('status', 'voided'),
    p_reason,
    v_corr
  );

  return v_expense;
end;
$$;

revoke all on function public.void_expense(uuid, text) from public;
grant execute on function public.void_expense(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- create_expense_amendment — clones confirmed expense into a draft successor
-- ---------------------------------------------------------------------------
create or replace function public.create_expense_amendment(
  p_expense_id uuid,
  p_reason text
)
returns public.expenses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_original public.expenses%rowtype;
  v_new public.expenses%rowtype;
  v_membership_id uuid;
  v_corr uuid := gen_random_uuid();
  v_item record;
  v_new_item_id uuid;
  v_alloc record;
  v_adj record;
  v_new_adj_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_reason is null or char_length(trim(p_reason)) < 1 then
    raise exception 'Amendment reason required';
  end if;

  perform set_config('householdos.expense_mutation', 'rpc', true);

  select * into v_original
  from public.expenses e
  where e.id = p_expense_id
  for update;

  if not found then
    raise exception 'Expense not found';
  end if;

  if v_original.status <> 'confirmed' then
    raise exception 'Only confirmed expenses can be amended';
  end if;

  if not public.can_confirm_or_void_expense(p_expense_id) then
    raise exception 'Not allowed to amend this expense';
  end if;

  if exists (
    select 1 from public.expense_amendments a
    where a.original_expense_id = p_expense_id
      and a.status = 'draft'
  ) then
    raise exception 'An amendment draft already exists for this expense';
  end if;

  v_membership_id := public.current_membership_id(v_original.household_id);

  insert into public.expenses (
    household_id,
    created_by_membership_id,
    payer_membership_id,
    merchant,
    description,
    category,
    purchase_date,
    currency,
    declared_total_cents,
    calculated_subtotal_cents,
    calculated_adjustments_cents,
    status,
    supersedes_expense_id
  ) values (
    v_original.household_id,
    v_membership_id,
    v_original.payer_membership_id,
    v_original.merchant,
    v_original.description,
    v_original.category,
    v_original.purchase_date,
    v_original.currency,
    v_original.declared_total_cents,
    v_original.calculated_subtotal_cents,
    v_original.calculated_adjustments_cents,
    'draft',
    v_original.id
  )
  returning * into v_new;

  for v_item in
    select * from public.expense_items where expense_id = p_expense_id order by display_order
  loop
    insert into public.expense_items (
      expense_id, household_id, description, quantity_label, total_cents,
      display_order, allocation_mode, personal_membership_id,
      exclude_from_adjustment_basis, classification
    ) values (
      v_new.id, v_new.household_id, v_item.description, v_item.quantity_label, v_item.total_cents,
      v_item.display_order, v_item.allocation_mode, v_item.personal_membership_id,
      v_item.exclude_from_adjustment_basis, v_item.classification
    )
    returning id into v_new_item_id;

    for v_alloc in
      select * from public.expense_item_allocations where item_id = v_item.id
    loop
      insert into public.expense_item_allocations (
        item_id, expense_id, household_id, membership_id,
        amount_cents, fixed_cents, percent_bps, weight
      ) values (
        v_new_item_id, v_new.id, v_new.household_id, v_alloc.membership_id,
        v_alloc.amount_cents, v_alloc.fixed_cents, v_alloc.percent_bps, v_alloc.weight
      );
    end loop;
  end loop;

  for v_adj in
    select * from public.expense_adjustments where expense_id = p_expense_id order by display_order
  loop
    insert into public.expense_adjustments (
      expense_id, household_id, adjustment_type, description, amount_cents,
      allocation_mode, assigned_membership_id, display_order
    ) values (
      v_new.id, v_new.household_id, v_adj.adjustment_type, v_adj.description, v_adj.amount_cents,
      v_adj.allocation_mode, v_adj.assigned_membership_id, v_adj.display_order
    )
    returning id into v_new_adj_id;

    for v_alloc in
      select * from public.expense_adjustment_allocations where adjustment_id = v_adj.id
    loop
      insert into public.expense_adjustment_allocations (
        adjustment_id, expense_id, household_id, membership_id,
        amount_cents, fixed_cents, percent_bps, weight
      ) values (
        v_new_adj_id, v_new.id, v_new.household_id, v_alloc.membership_id,
        v_alloc.amount_cents, v_alloc.fixed_cents, v_alloc.percent_bps, v_alloc.weight
      );
    end loop;
  end loop;

  insert into public.expense_amendments (
    household_id,
    original_expense_id,
    amendment_expense_id,
    reason,
    created_by_membership_id,
    status
  ) values (
    v_original.household_id,
    v_original.id,
    v_new.id,
    trim(p_reason),
    v_membership_id,
    'draft'
  );

  perform public._expense_audit(
    v_original.household_id,
    'expense',
    v_new.id,
    'expense.amendment_created',
    jsonb_build_object('original_expense_id', v_original.id),
    jsonb_build_object('amendment_expense_id', v_new.id, 'reason', trim(p_reason)),
    p_reason,
    v_corr
  );

  return v_new;
end;
$$;

revoke all on function public.create_expense_amendment(uuid, text) from public;
grant execute on function public.create_expense_amendment(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- confirm_expense_amendment — confirms successor + marks original amended
-- ---------------------------------------------------------------------------
create or replace function public.confirm_expense_amendment(
  p_amendment_expense_id uuid,
  p_idempotency_key text,
  p_snapshot jsonb
)
returns public.expenses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amendment public.expense_amendments%rowtype;
  v_original public.expenses%rowtype;
  v_confirmed public.expenses%rowtype;
  v_obl record;
  v_corr uuid := gen_random_uuid();
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  perform set_config('householdos.expense_mutation', 'rpc', true);

  select * into v_amendment
  from public.expense_amendments a
  where a.amendment_expense_id = p_amendment_expense_id
  for update;

  if not found then
    raise exception 'Amendment not found';
  end if;

  if v_amendment.status = 'confirmed' then
    select * into v_confirmed from public.expenses where id = p_amendment_expense_id;
    return v_confirmed;
  end if;

  if v_amendment.status <> 'draft' then
    raise exception 'Amendment is not in draft status';
  end if;

  select * into v_original
  from public.expenses e
  where e.id = v_amendment.original_expense_id
  for update;

  if v_original.status <> 'confirmed' then
    raise exception 'Original expense is not confirmed';
  end if;

  -- Reverse original pending obligations
  for v_obl in
    select * from public.reimbursement_obligations
    where expense_id = v_original.id
      and status = 'pending'
    for update
  loop
    update public.reimbursement_obligations
    set status = 'reversed',
        current_amount_cents = 0,
        updated_at = now()
    where id = v_obl.id;

    perform public._expense_audit(
      v_original.household_id,
      'reimbursement_obligation',
      v_obl.id,
      'reimbursement.reversed',
      jsonb_build_object('status', 'pending', 'amount_cents', v_obl.current_amount_cents),
      jsonb_build_object('status', 'reversed', 'amount_cents', 0, 'reason', 'amendment'),
      v_amendment.reason,
      v_corr
    );
  end loop;

  -- Confirm the amendment expense (creates new obligations)
  v_confirmed := public.confirm_expense(p_amendment_expense_id, p_idempotency_key, p_snapshot);

  update public.expenses
  set status = 'amended',
      superseded_by_expense_id = p_amendment_expense_id,
      updated_at = now()
  where id = v_original.id;

  update public.expense_amendments
  set status = 'confirmed',
      confirmed_at = now(),
      updated_at = now()
  where id = v_amendment.id;

  perform public._expense_audit(
    v_original.household_id,
    'expense',
    v_original.id,
    'expense.amended',
    jsonb_build_object('status', 'confirmed'),
    jsonb_build_object(
      'status', 'amended',
      'superseded_by_expense_id', p_amendment_expense_id
    ),
    v_amendment.reason,
    v_corr
  );

  return v_confirmed;
end;
$$;

revoke all on function public.confirm_expense_amendment(uuid, text, jsonb) from public;
grant execute on function public.confirm_expense_amendment(uuid, text, jsonb) to authenticated;
