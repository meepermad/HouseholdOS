-- Phase 3: harden void_expense and confirm_expense_amendment for paid obligations

create or replace function public._create_refund_obligation(
  p_household_id uuid,
  p_expense_id uuid,
  p_source_obligation_id uuid,
  p_original_debtor uuid,
  p_original_creditor uuid,
  p_amount_cents integer,
  p_amendment_id uuid,
  p_corr uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_creditor_user uuid;
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    return null;
  end if;

  insert into public.reimbursement_obligations (
    household_id,
    expense_id,
    creditor_membership_id,
    debtor_membership_id,
    original_amount_cents,
    current_amount_cents,
    status,
    obligation_kind,
    source_obligation_id,
    source_expense_amendment_id
  ) values (
    p_household_id,
    p_expense_id,
    p_original_debtor,   -- overpayer receives refund
    p_original_creditor, -- original creditor owes it back
    p_amount_cents,
    p_amount_cents,
    'pending',
    'refund',
    p_source_obligation_id,
    p_amendment_id
  )
  returning id into v_id;

  perform public._payment_audit(
    p_household_id,
    'reimbursement_obligation',
    v_id,
    'refund_obligation.created',
    null,
    jsonb_build_object(
      'source_obligation_id', p_source_obligation_id,
      'amount_cents', p_amount_cents,
      'obligation_kind', 'refund'
    ),
    null,
    p_corr
  );

  v_creditor_user := public._membership_user_id(p_original_debtor);
  perform public._emit_notification_event(
    p_household_id,
    'refund_obligation.created',
    'reimbursement_obligation',
    v_id,
    null,
    jsonb_build_object(
      'obligation_id', v_id,
      'amount_cents', p_amount_cents,
      'source_obligation_id', p_source_obligation_id
    ),
    'refund_obligation.created:' || v_id::text,
    array[v_creditor_user],
    'Refund obligation created',
    'An expense correction created a refund obligation for a prior overpayment.',
    '/app/' || p_household_id::text || '/money/reimbursements/' || v_id::text
  );

  return v_id;
end;
$$;

revoke all on function public._create_refund_obligation(uuid, uuid, uuid, uuid, uuid, integer, uuid, uuid) from public;

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
  v_paid integer;
  v_targets uuid[] := array[]::uuid[];
  v_uid uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_reason is null or char_length(trim(p_reason)) < 1 then
    raise exception 'Void reason required';
  end if;

  perform set_config('householdos.expense_mutation', 'rpc', true);
  perform set_config('householdos.payment_mutation', 'rpc', true);

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

  if exists (
    select 1
    from public.payment_allocations pa
    join public.payments p on p.id = pa.payment_id
    join public.reimbursement_obligations o on o.id = pa.obligation_id
    where o.expense_id = p_expense_id
      and p.status = 'submitted'
  ) then
    raise exception 'Expense correction conflict: cancel or resolve submitted payments first';
  end if;

  for v_obl in
    select * from public.reimbursement_obligations
    where expense_id = p_expense_id
      and status <> 'reversed'
    order by id
    for update
  loop
    v_paid := public.obligation_confirmed_paid_inline(v_obl.id);

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
      jsonb_build_object('status', v_obl.status, 'amount_cents', v_obl.current_amount_cents),
      jsonb_build_object('status', 'reversed', 'amount_cents', 0),
      p_reason,
      v_corr
    );

    if v_paid > 0 then
      perform public._create_refund_obligation(
        v_expense.household_id,
        v_expense.id,
        v_obl.id,
        v_obl.debtor_membership_id,
        v_obl.creditor_membership_id,
        v_paid,
        null,
        v_corr
      );
    end if;
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

  for v_uid in
    select m.user_id from public.household_memberships m
    where m.household_id = v_expense.household_id
      and m.status = 'active'
      and m.user_id is distinct from auth.uid()
  loop
    v_targets := array_append(v_targets, v_uid);
  end loop;

  perform public._emit_notification_event(
    v_expense.household_id,
    'expense.voided',
    'expense',
    p_expense_id,
    public.current_membership_id(v_expense.household_id),
    jsonb_build_object('expense_id', p_expense_id),
    'expense.voided:' || p_expense_id::text,
    v_targets,
    'Expense voided',
    'A confirmed expense was voided. Payment history was preserved.',
    '/app/' || v_expense.household_id::text || '/money/expenses/' || p_expense_id::text
  );

  return v_expense;
end;
$$;

revoke all on function public.void_expense(uuid, text) from public;
grant execute on function public.void_expense(uuid, text) to authenticated;

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
  v_paid integer;
  v_waived integer;
  v_new_amt integer;
  v_eff_before integer;
  v_orig_effective integer;
  v_remaining integer;
  v_refund integer;
  v_settled integer;
  v_succ_id uuid;
  v_targets uuid[] := array[]::uuid[];
  v_uid uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  perform set_config('householdos.expense_mutation', 'rpc', true);
  perform set_config('householdos.payment_mutation', 'rpc', true);

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

  if exists (
    select 1
    from public.payment_allocations pa
    join public.payments p on p.id = pa.payment_id
    join public.reimbursement_obligations o on o.id = pa.obligation_id
    where o.expense_id = v_original.id
      and p.status = 'submitted'
  ) then
    raise exception 'Expense correction conflict: cancel or resolve submitted payments first';
  end if;

  -- Apply paid-aware adjustments to originals before / around successor confirm
  for v_obl in
    select * from public.reimbursement_obligations
    where expense_id = v_original.id
      and status <> 'reversed'
    order by id
    for update
  loop
    v_paid := public.obligation_confirmed_paid_inline(v_obl.id);
    v_waived := public.obligation_waived_cents_inline(v_obl.id);
    v_eff_before := v_obl.current_amount_cents;

    select coalesce((
      select (elem->>'amount_cents')::integer
      from jsonb_array_elements(coalesce(p_snapshot->'obligations', '[]'::jsonb)) as elem
      where (elem->>'debtor_membership_id')::uuid = v_obl.debtor_membership_id
        and (elem->>'creditor_membership_id')::uuid = v_obl.creditor_membership_id
      limit 1
    ), 0) into v_new_amt;

    if v_paid = 0 and v_waived = 0 then
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
        jsonb_build_object('status', v_obl.status, 'amount_cents', v_eff_before),
        jsonb_build_object('status', 'reversed', 'amount_cents', 0, 'reason', 'amendment'),
        v_amendment.reason,
        v_corr
      );
    else
      -- planAmendmentAfterPayment
      v_settled := v_paid + v_waived;
      if v_new_amt = 0 then
        v_orig_effective := 0;
        v_remaining := 0;
        v_refund := v_paid;
      elsif v_new_amt <= v_eff_before then
        if v_new_amt >= v_settled then
          v_orig_effective := v_new_amt;
          v_remaining := v_new_amt - v_settled;
          v_refund := 0;
        else
          v_orig_effective := v_new_amt;
          v_remaining := 0;
          v_refund := greatest(0, v_paid - v_new_amt);
        end if;
      else
        v_orig_effective := v_eff_before;
        v_remaining := v_new_amt - v_eff_before;
        v_refund := 0;
      end if;

      update public.reimbursement_obligations
      set current_amount_cents = v_orig_effective,
          status = case when v_orig_effective = 0 then 'reversed' else status end,
          updated_at = now()
      where id = v_obl.id;

      perform public._expense_audit(
        v_original.household_id,
        'reimbursement_obligation',
        v_obl.id,
        'reimbursement.adjusted',
        jsonb_build_object('effective_amount_cents', v_eff_before),
        jsonb_build_object(
          'effective_amount_cents', v_orig_effective,
          'refund_cents', v_refund,
          'successor_delta_cents', case when v_new_amt > v_eff_before then v_remaining else 0 end
        ),
        v_amendment.reason,
        v_corr
      );

      if v_refund > 0 then
        perform public._create_refund_obligation(
          v_original.household_id,
          v_original.id,
          v_obl.id,
          v_obl.debtor_membership_id,
          v_obl.creditor_membership_id,
          v_refund,
          v_amendment.id,
          v_corr
        );
      end if;

      -- Mark snapshot obligation for later delta rewrite via temp note in after_state is hard;
      -- store intended successor amount on a session GUC map is painful. Instead rewrite after confirm.
      perform set_config(
        'householdos.amend_keep_' || replace(v_obl.debtor_membership_id::text || '_' || v_obl.creditor_membership_id::text, '-', ''),
        case
          when v_new_amt > v_eff_before then v_remaining::text
          else '0'
        end,
        true
      );
    end if;
  end loop;

  -- Confirm successor (creates full obligations from snapshot)
  v_confirmed := public.confirm_expense(p_amendment_expense_id, p_idempotency_key, p_snapshot);

  -- Rewrite successor obligations for pairs that kept paid originals
  for v_obl in
    select * from public.reimbursement_obligations
    where expense_id = v_original.id
      and obligation_kind = 'reimbursement'
  loop
    select id into v_succ_id
    from public.reimbursement_obligations
    where expense_id = p_amendment_expense_id
      and debtor_membership_id = v_obl.debtor_membership_id
      and creditor_membership_id = v_obl.creditor_membership_id;

    if v_succ_id is null then
      continue;
    end if;

    -- If original still has positive effective (kept for payments), adjust/remove successor
    if v_obl.status <> 'reversed' or public.obligation_confirmed_paid_inline(v_obl.id) > 0 then
      v_remaining := coalesce(
        nullif(
          current_setting(
            'householdos.amend_keep_' || replace(v_obl.debtor_membership_id::text || '_' || v_obl.creditor_membership_id::text, '-', ''),
            true
          ),
          ''
        )::integer,
        -1
      );

      if v_remaining = 0 then
        update public.reimbursement_obligations
        set status = 'reversed',
            current_amount_cents = 0,
            updated_at = now()
        where id = v_succ_id;
      elsif v_remaining > 0 then
        update public.reimbursement_obligations
        set original_amount_cents = v_remaining,
            current_amount_cents = v_remaining,
            source_obligation_id = v_obl.id,
            source_expense_amendment_id = v_amendment.id,
            updated_at = now()
        where id = v_succ_id;
      end if;
    end if;

    perform public._sync_obligation_settlement_status(v_obl.id);
  end loop;

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

  for v_uid in
    select m.user_id from public.household_memberships m
    where m.household_id = v_original.household_id
      and m.status = 'active'
      and m.user_id is distinct from auth.uid()
  loop
    v_targets := array_append(v_targets, v_uid);
  end loop;

  perform public._emit_notification_event(
    v_original.household_id,
    'expense.amended',
    'expense',
    v_original.id,
    public.current_membership_id(v_original.household_id),
    jsonb_build_object(
      'original_expense_id', v_original.id,
      'amendment_expense_id', p_amendment_expense_id
    ),
    'expense.amended:' || v_original.id::text,
    v_targets,
    'Expense amended',
    'A confirmed expense was amended. Prior payment history was preserved.',
    '/app/' || v_original.household_id::text || '/money/expenses/' || p_amendment_expense_id::text
  );

  return v_confirmed;
end;
$$;

revoke all on function public.confirm_expense_amendment(uuid, text, jsonb) from public;
grant execute on function public.confirm_expense_amendment(uuid, text, jsonb) to authenticated;
