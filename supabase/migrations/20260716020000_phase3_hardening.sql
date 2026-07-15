-- Phase 3 hardening: privileged mutation gate, minimal notification payloads,
-- clear amend/void conflict messages with blocking payment id.

-- ---------------------------------------------------------------------------
-- Privileged mutation: service_role JWT alone is not enough — require GUC.
-- Ordinary authenticated sessions and bare null uid never bypass RPC gates.
-- ---------------------------------------------------------------------------
create or replace function public._allow_privileged_mutation()
returns boolean
language plpgsql
stable
as $$
begin
  -- Explicit opt-in for the current transaction (tests / approved maintenance).
  if current_setting('householdos.privileged_mutation', true) is distinct from 'on' then
    return false;
  end if;
  -- Must be the Supabase service_role JWT (never anon / authenticated users).
  if coalesce(auth.jwt() ->> 'role', '') is distinct from 'service_role' then
    return false;
  end if;
  return true;
end;
$$;

revoke all on function public._allow_privileged_mutation() from public;

create or replace function public.enforce_payment_rpc_only()
returns trigger
language plpgsql
as $$
begin
  if public._allow_privileged_mutation() then
    return coalesce(new, old);
  end if;
  if current_setting('householdos.payment_mutation', true) is distinct from 'rpc'
     and current_setting('householdos.expense_mutation', true) is distinct from 'rpc' then
    raise exception 'Payment settlement records may only be written by secure functions';
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function public.enforce_obligation_rpc_only()
returns trigger
language plpgsql
as $$
begin
  if public._allow_privileged_mutation() then
    return coalesce(new, old);
  end if;
  if current_setting('householdos.expense_mutation', true) is distinct from 'rpc'
     and current_setting('householdos.payment_mutation', true) is distinct from 'rpc' then
    raise exception 'Reimbursement obligations may only be written by secure functions';
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function public.enforce_expense_immutability()
returns trigger
language plpgsql
as $$
begin
  if public._allow_privileged_mutation() then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    if old.status in ('confirmed', 'amended', 'voided') then
      raise exception 'Confirmed financial records cannot be deleted';
    end if;
    return old;
  end if;

  if old.status in ('confirmed', 'amended', 'voided') then
    if current_setting('householdos.expense_mutation', true) is distinct from 'rpc' then
      raise exception 'Confirmed expenses are immutable; use amendment or void workflows';
    end if;
  end if;

  if tg_op = 'UPDATE'
     and old.status in ('draft', 'ready_for_review')
     and new.status in ('confirmed', 'amended', 'voided')
     and current_setting('householdos.expense_mutation', true) is distinct from 'rpc' then
    raise exception 'Expense confirmation must use confirm_expense RPC';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_draft_child_mutability()
returns trigger
language plpgsql
as $$
declare
  v_status text;
  v_expense_id uuid;
begin
  if public._allow_privileged_mutation() then
    return coalesce(new, old);
  end if;

  v_expense_id := coalesce(new.expense_id, old.expense_id);
  select e.status into v_status from public.expenses e where e.id = v_expense_id;
  if v_status is null then
    return coalesce(new, old);
  end if;
  if v_status not in ('draft', 'ready_for_review')
     and current_setting('householdos.expense_mutation', true) is distinct from 'rpc' then
    raise exception 'Cannot modify items on a confirmed expense';
  end if;
  return coalesce(new, old);
end;
$$;

-- Scoped test cleanup: requires service_role + privileged GUC + non-empty test run id.
-- Only deletes households whose name contains the test-run identifier.
create or replace function public.cleanup_test_household_data(p_test_run_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
  v_count integer := 0;
  v_id uuid;
begin
  if coalesce(auth.jwt() ->> 'role', '') is distinct from 'service_role' then
    raise exception 'cleanup_test_household_data requires service_role';
  end if;
  if p_test_run_id is null
     or char_length(trim(p_test_run_id)) < 8
     or trim(p_test_run_id) !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'cleanup_test_household_data requires a safe test-run identifier';
  end if;

  perform set_config('householdos.privileged_mutation', 'on', true);

  select array_agg(h.id) into v_ids
  from public.households h
  where h.name like '%' || trim(p_test_run_id) || '%';

  if v_ids is null then
    return 0;
  end if;

  foreach v_id in array v_ids loop
    -- Order respects FK restrict edges used in Phase 2/3 schemas.
    delete from public.notification_deliveries d
      using public.notification_events e
      where e.id = d.event_id and e.household_id = v_id;
    delete from public.user_notifications where household_id = v_id;
    delete from public.notification_events where household_id = v_id;
    delete from public.dispute_events where household_id = v_id;
    delete from public.reimbursement_disputes where household_id = v_id;
    delete from public.reimbursement_waiver_reversals where household_id = v_id;
    delete from public.reimbursement_waivers where household_id = v_id;
    delete from public.payment_reversals where household_id = v_id;
    delete from public.payment_allocations where household_id = v_id;
    delete from public.payment_private_details where household_id = v_id;
    delete from public.payments where household_id = v_id;
    delete from public.reimbursement_obligations where household_id = v_id;
    delete from public.expense_amendments where household_id = v_id;
    delete from public.expense_adjustment_allocations where household_id = v_id;
    delete from public.expense_item_allocations where household_id = v_id;
    delete from public.expense_adjustments where household_id = v_id;
    delete from public.expense_items where household_id = v_id;
    update public.expenses
      set superseded_by_expense_id = null, supersedes_expense_id = null
      where household_id = v_id;
    delete from public.expenses where household_id = v_id;
    delete from public.audit_events where household_id = v_id;
    delete from public.household_invitations where household_id = v_id;
    delete from public.household_settings where household_id = v_id;
    update public.user_preferences
      set current_household_id = null
      where current_household_id = v_id;
    delete from public.household_membership_roles r
      using public.household_memberships m
      where m.id = r.membership_id and m.household_id = v_id;
    delete from public.household_memberships where household_id = v_id;
    delete from public.households where id = v_id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.cleanup_test_household_data(text) from public;
-- Callable only with the service_role JWT (secret key). Never grant to authenticated/anon.
grant execute on function public.cleanup_test_household_data(text) to service_role;

-- ---------------------------------------------------------------------------
-- Notification payloads: store only routing metadata on shared outbox rows.
-- ---------------------------------------------------------------------------
create or replace function public._emit_notification_event(
  p_household_id uuid,
  p_event_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_actor_membership_id uuid,
  p_payload jsonb,
  p_idempotency_key text,
  p_recipient_user_ids uuid[],
  p_title text,
  p_body text,
  p_action_href text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_uid uuid;
  v_safe jsonb;
begin
  -- Discard caller payload richness; keep routing keys only.
  v_safe := jsonb_build_object(
    'source_type', p_entity_type,
    'source_id', p_entity_id
  );

  if coalesce(p_title, '') ~* '(password|token|secret|external_reference)'
     or coalesce(p_body, '') ~* '(password|token|secret|external_reference)'
     or coalesce(p_action_href, '') ~* '(password|token|secret)' then
    raise exception 'Notification content contains forbidden fields';
  end if;

  insert into public.notification_events (
    household_id,
    event_type,
    entity_type,
    entity_id,
    actor_membership_id,
    payload,
    idempotency_key
  ) values (
    p_household_id,
    p_event_type,
    p_entity_type,
    p_entity_id,
    p_actor_membership_id,
    v_safe,
    p_idempotency_key
  )
  on conflict (idempotency_key) do update
    set idempotency_key = excluded.idempotency_key
  returning id into v_event_id;

  if v_event_id is null then
    select id into v_event_id
    from public.notification_events
    where idempotency_key = p_idempotency_key;
  end if;

  if p_recipient_user_ids is not null then
    foreach v_uid in array p_recipient_user_ids loop
      if v_uid is null then
        continue;
      end if;
      begin
        insert into public.user_notifications (
          user_id, event_id, household_id, title, body, action_href
        ) values (
          v_uid, v_event_id, p_household_id, p_title, coalesce(p_body, ''), p_action_href
        )
        on conflict (event_id, user_id) do nothing;

        insert into public.notification_deliveries (
          event_id, user_id, channel, status
        ) values (
          v_event_id, v_uid, 'in_app', 'sent'
        )
        on conflict (event_id, user_id, channel) do nothing;

        insert into public.notification_deliveries (
          event_id, user_id, channel, status
        ) values (
          v_event_id, v_uid, 'web_push', 'pending'
        )
        on conflict (event_id, user_id, channel) do nothing;
      exception
        when others then
          raise warning 'notification fan-out failed for user %: %', v_uid, sqlerrm;
      end;
    end loop;
  end if;

  return v_event_id;
exception
  when others then
    if v_event_id is null then
      raise;
    end if;
    raise warning 'notification emit recovered after fan-out error: %', sqlerrm;
    return v_event_id;
end;
$$;

revoke all on function public._emit_notification_event(uuid, text, text, uuid, uuid, jsonb, text, uuid[], text, text, text) from public;

-- ---------------------------------------------------------------------------
-- Amend/void: surface blocking payment id in the exception text.
-- ---------------------------------------------------------------------------
create or replace function public._blocking_submitted_payment_id(p_expense_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.payment_allocations pa
  join public.payments p on p.id = pa.payment_id
  join public.reimbursement_obligations o on o.id = pa.obligation_id
  where o.expense_id = p_expense_id
    and p.status = 'submitted'
  order by p.submitted_at nulls last, p.id
  limit 1;
$$;

revoke all on function public._blocking_submitted_payment_id(uuid) from public;

create or replace function public._raise_if_submitted_payments(p_expense_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment_id uuid;
begin
  v_payment_id := public._blocking_submitted_payment_id(p_expense_id);
  if v_payment_id is not null then
    raise exception
      'Expense correction conflict: submitted payment % awaiting action',
      v_payment_id;
  end if;
end;
$$;

revoke all on function public._raise_if_submitted_payments(uuid) from public;

-- Hot-patch void_expense / confirm_expense_amendment conflict checks via
-- wrapping helpers invoked by recreating those entrypoints' guards.
-- (Full bodies retained from prior migration; only conflict gate changes.)

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

  select * into v_expense from public.expenses e where e.id = p_expense_id for update;
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

  perform public._raise_if_submitted_payments(p_expense_id);

  for v_obl in
    select * from public.reimbursement_obligations
    where expense_id = p_expense_id and status <> 'reversed'
    order by id for update
  loop
    v_paid := public.obligation_confirmed_paid_inline(v_obl.id);
    update public.reimbursement_obligations
    set status = 'reversed', current_amount_cents = 0, updated_at = now()
    where id = v_obl.id;
    perform public._expense_audit(
      v_expense.household_id, 'reimbursement_obligation', v_obl.id,
      'reimbursement.reversed',
      jsonb_build_object('status', v_obl.status, 'amount_cents', v_obl.current_amount_cents),
      jsonb_build_object('status', 'reversed', 'amount_cents', 0),
      p_reason, v_corr
    );
    if v_paid > 0 then
      perform public._create_refund_obligation(
        v_expense.household_id, v_expense.id, v_obl.id,
        v_obl.debtor_membership_id, v_obl.creditor_membership_id,
        v_paid, null, v_corr
      );
    end if;
  end loop;

  update public.expenses
  set status = 'voided', voided_at = now(), void_reason = trim(p_reason), updated_at = now()
  where id = p_expense_id
  returning * into v_expense;

  perform public._expense_audit(
    v_expense.household_id, 'expense', p_expense_id, 'expense.voided',
    jsonb_build_object('status', 'confirmed'),
    jsonb_build_object('status', 'voided'),
    p_reason, v_corr
  );

  for v_uid in
    select m.user_id from public.household_memberships m
    where m.household_id = v_expense.household_id and m.status = 'active'
      and m.user_id is distinct from auth.uid()
  loop
    v_targets := array_append(v_targets, v_uid);
  end loop;

  perform public._emit_notification_event(
    v_expense.household_id, 'expense.voided', 'expense', p_expense_id,
    public.current_membership_id(v_expense.household_id),
    '{}'::jsonb,
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

  perform public._raise_if_submitted_payments(v_original.id);

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
