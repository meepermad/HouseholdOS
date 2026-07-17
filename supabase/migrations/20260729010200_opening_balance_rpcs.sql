-- Completion-B: opening balance RPCs

create or replace function public.create_opening_balance_entry(
  p_household_id uuid,
  p_debtor_membership_id uuid,
  p_creditor_membership_id uuid,
  p_amount_cents integer,
  p_currency text,
  p_effective_date date,
  p_explanation text,
  p_idempotency_key text default null,
  p_attachment_storage_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_active_member(p_household_id) then
    raise exception 'Not an active household member';
  end if;
  v_actor := public.current_membership_id(p_household_id);
  if p_debtor_membership_id = p_creditor_membership_id then
    raise exception 'Debtor and creditor must differ';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'Amount must be a positive integer cent value';
  end if;
  if not exists (
    select 1 from public.household_memberships m
    where m.id = p_debtor_membership_id and m.household_id = p_household_id and m.status = 'active'
  ) or not exists (
    select 1 from public.household_memberships m
    where m.id = p_creditor_membership_id and m.household_id = p_household_id and m.status = 'active'
  ) then
    raise exception 'Debtor and creditor must be active household members';
  end if;

  if p_idempotency_key is not null then
    select id into v_id from public.opening_balance_entries
    where client_idempotency_key = p_idempotency_key;
    if found then return v_id; end if;
  end if;

  insert into public.opening_balance_entries (
    household_id, debtor_membership_id, creditor_membership_id,
    amount_cents, currency, effective_date, explanation,
    attachment_storage_path, created_by_membership_id, status, client_idempotency_key
  ) values (
    p_household_id, p_debtor_membership_id, p_creditor_membership_id,
    p_amount_cents, upper(p_currency), p_effective_date, trim(p_explanation),
    p_attachment_storage_path, v_actor, 'draft', p_idempotency_key
  ) returning id into v_id;

  insert into public.opening_balance_events (entry_id, household_id, event_type, actor_membership_id, detail)
  values (v_id, p_household_id, 'opening_balance.created', v_actor, jsonb_build_object('amount_cents', p_amount_cents));

  return v_id;
end;
$$;

create or replace function public.submit_opening_balance_for_confirmation(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.opening_balance_entries%rowtype;
  v_actor uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_row from public.opening_balance_entries where id = p_entry_id for update;
  if not found then raise exception 'Opening balance not found'; end if;
  v_actor := public.current_membership_id(v_row.household_id);
  if v_actor is distinct from v_row.created_by_membership_id
     and not public._is_financial_coordinator(v_row.household_id) then
    raise exception 'Only the creator can submit for confirmation';
  end if;
  if v_row.status <> 'draft' then raise exception 'Only draft entries can be submitted'; end if;

  update public.opening_balance_entries set status = 'awaiting_confirmation', updated_at = now()
  where id = p_entry_id;

  insert into public.opening_balance_events (entry_id, household_id, event_type, actor_membership_id)
  values (p_entry_id, v_row.household_id, 'opening_balance.submitted', v_actor);
end;
$$;

create or replace function public.respond_opening_balance(
  p_entry_id uuid,
  p_decision text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.opening_balance_entries%rowtype;
  v_actor uuid;
  v_debtor_ok boolean := false;
  v_creditor_ok boolean := false;
  v_obl uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_decision not in ('approved', 'rejected') then raise exception 'Invalid decision'; end if;
  select * into v_row from public.opening_balance_entries where id = p_entry_id for update;
  if not found then raise exception 'Opening balance not found'; end if;
  v_actor := public.current_membership_id(v_row.household_id);
  if v_actor is distinct from v_row.debtor_membership_id
     and v_actor is distinct from v_row.creditor_membership_id then
    raise exception 'Only the debtor or creditor may respond';
  end if;
  -- Coordinator cannot bypass participant approval
  if v_row.status <> 'awaiting_confirmation' then
    raise exception 'Entry is not awaiting confirmation';
  end if;

  insert into public.opening_balance_approvals (entry_id, household_id, membership_id, decision, note)
  values (p_entry_id, v_row.household_id, v_actor, p_decision, p_note)
  on conflict (entry_id, membership_id) do update
    set decision = excluded.decision, note = excluded.note;

  if p_decision = 'rejected' then
    update public.opening_balance_entries set status = 'rejected', updated_at = now() where id = p_entry_id;
    insert into public.opening_balance_events (entry_id, household_id, event_type, actor_membership_id, detail)
    values (p_entry_id, v_row.household_id, 'opening_balance.rejected', v_actor, jsonb_build_object('note', p_note));
    return;
  end if;

  select exists (
    select 1 from public.opening_balance_approvals
    where entry_id = p_entry_id and membership_id = v_row.debtor_membership_id and decision = 'approved'
  ) into v_debtor_ok;
  select exists (
    select 1 from public.opening_balance_approvals
    where entry_id = p_entry_id and membership_id = v_row.creditor_membership_id and decision = 'approved'
  ) into v_creditor_ok;

  if v_debtor_ok and v_creditor_ok then
    insert into public.reimbursement_obligations (
      household_id, expense_id, creditor_membership_id, debtor_membership_id,
      original_amount_cents, current_amount_cents, status, obligation_kind
    ) values (
      v_row.household_id, null, v_row.creditor_membership_id, v_row.debtor_membership_id,
      v_row.amount_cents, v_row.amount_cents, 'pending', 'opening_balance'
    ) returning id into v_obl;

    update public.opening_balance_entries
    set status = 'confirmed', obligation_id = v_obl, updated_at = now()
    where id = p_entry_id;

    insert into public.opening_balance_events (entry_id, household_id, event_type, actor_membership_id, detail)
    values (p_entry_id, v_row.household_id, 'opening_balance.confirmed', v_actor,
      jsonb_build_object('obligation_id', v_obl));

    insert into public.audit_events (
      household_id, actor_user_id, entity_type, entity_id, event_type, after_state
    ) values (
      v_row.household_id, auth.uid(), 'opening_balance_entry', p_entry_id, 'opening_balance.confirmed',
      jsonb_build_object('obligation_id', v_obl, 'amount_cents', v_row.amount_cents)
    );
  end if;
end;
$$;

create or replace function public.cancel_opening_balance(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.opening_balance_entries%rowtype;
  v_actor uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_row from public.opening_balance_entries where id = p_entry_id for update;
  if not found then raise exception 'Opening balance not found'; end if;
  v_actor := public.current_membership_id(v_row.household_id);
  if v_actor is distinct from v_row.created_by_membership_id
     and not public._is_financial_coordinator(v_row.household_id) then
    raise exception 'Not authorized to cancel';
  end if;
  if v_row.status not in ('draft', 'awaiting_confirmation') then
    raise exception 'Cannot cancel in current status';
  end if;
  update public.opening_balance_entries set status = 'cancelled', updated_at = now() where id = p_entry_id;
  insert into public.opening_balance_events (entry_id, household_id, event_type, actor_membership_id)
  values (p_entry_id, v_row.household_id, 'opening_balance.cancelled', v_actor);
end;
$$;

revoke all on function public.create_opening_balance_entry(uuid, uuid, uuid, integer, text, date, text, text, text) from public;
revoke all on function public.submit_opening_balance_for_confirmation(uuid) from public;
revoke all on function public.respond_opening_balance(uuid, text, text) from public;
revoke all on function public.cancel_opening_balance(uuid) from public;

grant execute on function public.create_opening_balance_entry(uuid, uuid, uuid, integer, text, date, text, text, text) to authenticated;
grant execute on function public.submit_opening_balance_for_confirmation(uuid) to authenticated;
grant execute on function public.respond_opening_balance(uuid, text, text) to authenticated;
grant execute on function public.cancel_opening_balance(uuid) to authenticated;
