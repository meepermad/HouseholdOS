-- Security-A: routed settlement payer auth, scoped idempotency, correction workflow.
-- Do not rewrite prior migrations; additive replacements only.

-- ---------------------------------------------------------------------------
-- Idempotency: scope to household + creating actor (was global unique)
-- ---------------------------------------------------------------------------
alter table public.routed_settlement_proposals
  drop constraint if exists routed_settlement_proposals_client_idempotency_key_key;

create unique index if not exists routed_settlement_proposals_scoped_idempotency_uidx
  on public.routed_settlement_proposals (
    household_id,
    created_by_membership_id,
    client_idempotency_key
  )
  where client_idempotency_key is not null;

-- ---------------------------------------------------------------------------
-- Correction / reversal request tables (append-only lifecycle)
-- ---------------------------------------------------------------------------
create table if not exists public.routed_settlement_correction_requests (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null,
  household_id uuid not null,
  requested_by_membership_id uuid not null references public.household_memberships(id) on delete restrict,
  correction_path text not null check (correction_path in (
    'external_payment_returned',
    'accounting_correction',
    'payment_confirmation_disputed',
    'administrative_correction'
  )),
  reason text not null check (char_length(trim(reason)) >= 3),
  status text not null default 'pending' check (status in (
    'pending',
    'awaiting_recipient',
    'awaiting_participants',
    'approved',
    'applied',
    'declined',
    'disputed',
    'cancelled'
  )),
  recipient_decision text check (
    recipient_decision is null
    or recipient_decision in ('confirmed_return', 'declined_return', 'disputed_receipt')
  ),
  recipient_decided_at timestamptz,
  payment_reversal_id uuid references public.payment_reversals(id) on delete set null,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (proposal_id, household_id)
    references public.routed_settlement_proposals(id, household_id) on delete cascade
);

-- At most one open or applied correction chain per proposal (declined/disputed may retry).
create unique index if not exists routed_correction_one_open_or_applied_uidx
  on public.routed_settlement_correction_requests (proposal_id)
  where status in (
    'pending',
    'awaiting_recipient',
    'awaiting_participants',
    'approved',
    'applied'
  );

create table if not exists public.routed_settlement_correction_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.routed_settlement_correction_requests(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete restrict,
  membership_id uuid not null references public.household_memberships(id) on delete restrict,
  role text not null check (role in ('payer', 'intermediary', 'recipient')),
  decision text not null check (decision in ('approved', 'declined')),
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  unique (request_id, membership_id, role)
);

create trigger routed_settlement_correction_requests_set_updated_at
  before update on public.routed_settlement_correction_requests
  for each row execute function public.set_updated_at();

alter table public.routed_settlement_correction_requests enable row level security;
alter table public.routed_settlement_correction_responses enable row level security;

drop policy if exists routed_correction_requests_select on public.routed_settlement_correction_requests;
create policy routed_correction_requests_select
  on public.routed_settlement_correction_requests for select
  using (public.can_view_routed_settlement(proposal_id));

drop policy if exists routed_correction_requests_no_write on public.routed_settlement_correction_requests;
create policy routed_correction_requests_no_write
  on public.routed_settlement_correction_requests for all
  using (false) with check (false);

drop policy if exists routed_correction_responses_select on public.routed_settlement_correction_responses;
create policy routed_correction_responses_select
  on public.routed_settlement_correction_responses for select
  using (
    exists (
      select 1 from public.routed_settlement_correction_requests r
      where r.id = request_id and public.can_view_routed_settlement(r.proposal_id)
    )
  );

drop policy if exists routed_correction_responses_no_write on public.routed_settlement_correction_responses;
create policy routed_correction_responses_no_write
  on public.routed_settlement_correction_responses for all
  using (false) with check (false);

grant select on public.routed_settlement_correction_requests to authenticated;
grant select on public.routed_settlement_correction_responses to authenticated;

-- ---------------------------------------------------------------------------
-- create_routed_settlement_proposal: payer must be actor; scoped idempotency
-- ---------------------------------------------------------------------------
create or replace function public.create_routed_settlement_proposal(
  p_household_id uuid,
  p_payer_membership_id uuid,
  p_intermediary_membership_id uuid,
  p_recipient_membership_id uuid,
  p_amount_cents integer,
  p_obligation_ab_id uuid,
  p_obligation_bc_id uuid,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_ab public.reimbursement_obligations%rowtype;
  v_bc public.reimbursement_obligations%rowtype;
  v_ab_out integer;
  v_bc_out integer;
  v_currency text;
  v_id uuid;
  v_max integer;
  v_intermediary_user uuid;
  v_existing public.routed_settlement_proposals%rowtype;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_active_member(p_household_id) then
    raise exception 'Not an active household member';
  end if;
  v_actor := public.current_membership_id(p_household_id);

  -- Ordinary proposals: only the payer may create a binding proposal.
  if v_actor is distinct from p_payer_membership_id then
    raise exception 'Only the payer may create a routed settlement proposal';
  end if;

  if p_idempotency_key is not null then
    select * into v_existing
    from public.routed_settlement_proposals
    where household_id = p_household_id
      and created_by_membership_id = v_actor
      and client_idempotency_key = p_idempotency_key;
    if found then
      if v_existing.payer_membership_id is distinct from p_payer_membership_id
         or v_existing.intermediary_membership_id is distinct from p_intermediary_membership_id
         or v_existing.recipient_membership_id is distinct from p_recipient_membership_id
         or v_existing.amount_cents is distinct from p_amount_cents
         or v_existing.source_obligation_ab_id is distinct from p_obligation_ab_id
         or v_existing.source_obligation_bc_id is distinct from p_obligation_bc_id then
        raise exception 'Idempotency key reuse with mismatched parameters';
      end if;
      return v_existing.id;
    end if;
  end if;

  if p_payer_membership_id = p_intermediary_membership_id
     or p_intermediary_membership_id = p_recipient_membership_id
     or p_payer_membership_id = p_recipient_membership_id then
    raise exception 'Payer, intermediary, and recipient must be distinct';
  end if;

  -- Active membership checks for all three parties
  if not exists (
    select 1 from public.household_memberships m
    where m.id = p_payer_membership_id
      and m.household_id = p_household_id
      and m.status = 'active'
  ) then raise exception 'Payer is not an active household member'; end if;
  if not exists (
    select 1 from public.household_memberships m
    where m.id = p_intermediary_membership_id
      and m.household_id = p_household_id
      and m.status = 'active'
  ) then raise exception 'Intermediary is not an active household member'; end if;
  if not exists (
    select 1 from public.household_memberships m
    where m.id = p_recipient_membership_id
      and m.household_id = p_household_id
      and m.status = 'active'
  ) then raise exception 'Recipient is not an active household member'; end if;

  select * into v_ab from public.reimbursement_obligations where id = p_obligation_ab_id for update;
  if not found then raise exception 'A→B obligation not found'; end if;
  select * into v_bc from public.reimbursement_obligations where id = p_obligation_bc_id for update;
  if not found then raise exception 'B→C obligation not found'; end if;

  if v_ab.household_id <> p_household_id or v_bc.household_id <> p_household_id then
    raise exception 'Source obligations not found in household';
  end if;
  if v_ab.debtor_membership_id <> p_payer_membership_id
     or v_ab.creditor_membership_id <> p_intermediary_membership_id then
    raise exception 'A→B obligation parties mismatch';
  end if;
  if v_bc.debtor_membership_id <> p_intermediary_membership_id
     or v_bc.creditor_membership_id <> p_recipient_membership_id then
    raise exception 'B→C obligation parties mismatch';
  end if;
  if v_ab.status in ('reversed','waived') or v_bc.status in ('reversed','waived') then
    raise exception 'Source obligations are not eligible';
  end if;
  if exists (
    select 1 from public.reimbursement_disputes d
    where d.household_id = p_household_id
      and d.status in ('open', 'under_review')
      and (d.obligation_id = p_obligation_ab_id or d.obligation_id = p_obligation_bc_id)
  ) then
    raise exception 'Cannot route disputed obligations';
  end if;

  select coalesce(
    (select e.currency from public.expenses e where e.id = v_ab.expense_id),
    (select h.currency from public.households h where h.id = p_household_id),
    'USD'
  ) into v_currency;

  v_ab_out := public._routed_available_cents(p_obligation_ab_id, null);
  v_bc_out := public._routed_available_cents(p_obligation_bc_id, null);
  v_max := least(v_ab_out, v_bc_out);
  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > v_max then
    raise exception 'Routed amount exceeds available outstanding (max %)', v_max;
  end if;

  insert into public.routed_settlement_proposals (
    household_id, payer_membership_id, intermediary_membership_id, recipient_membership_id,
    amount_cents, currency, source_obligation_ab_id, source_obligation_bc_id,
    balance_snapshot, expires_at, status, client_idempotency_key, created_by_membership_id
  ) values (
    p_household_id, p_payer_membership_id, p_intermediary_membership_id, p_recipient_membership_id,
    p_amount_cents, v_currency, p_obligation_ab_id, p_obligation_bc_id,
    jsonb_build_object(
      'ab_outstanding_cents', v_ab_out,
      'bc_outstanding_cents', v_bc_out,
      'max_routable_cents', v_max
    ),
    now() + interval '7 days',
    'awaiting_intermediary_approval',
    p_idempotency_key,
    v_actor
  ) returning id into v_id;

  insert into public.routed_settlement_legs (proposal_id, household_id, leg_kind, obligation_id, amount_cents)
  values
    (v_id, p_household_id, 'a_to_b', p_obligation_ab_id, p_amount_cents),
    (v_id, p_household_id, 'b_to_c', p_obligation_bc_id, p_amount_cents),
    (v_id, p_household_id, 'a_to_c_external', null, p_amount_cents);

  insert into public.routed_settlement_reservations (proposal_id, household_id, obligation_id, amount_cents)
  values
    (v_id, p_household_id, p_obligation_ab_id, p_amount_cents),
    (v_id, p_household_id, p_obligation_bc_id, p_amount_cents);

  insert into public.routed_settlement_events (proposal_id, household_id, event_type, actor_membership_id, detail)
  values (v_id, p_household_id, 'settlement.route_proposed', v_actor,
    jsonb_build_object('amount_cents', p_amount_cents));

  v_intermediary_user := public._membership_user_id(p_intermediary_membership_id);
  if v_intermediary_user is not null then
    perform public._emit_notification_event(
      p_household_id,
      'settlement.intermediary_approval_required',
      'routed_settlement',
      v_id,
      v_actor,
      jsonb_build_object('source_type', 'routed_settlement', 'source_id', v_id),
      'settlement.intermediary_approval_required:' || v_id::text,
      array[v_intermediary_user],
      'Routed payment needs your approval',
      'A roommate wants to simplify balances through you. Review in the app.',
      '/app/' || p_household_id::text || '/money/simplify/' || v_id::text
    );
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Block unsafe unilateral reverse; use correction workflow instead
-- ---------------------------------------------------------------------------
create or replace function public.reverse_routed_settlement(
  p_proposal_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception
    'Unilateral routed reversal is disabled. Use request_routed_settlement_correction so the linked payment is reconciled before obligations are restored.';
end;
$$;

-- ---------------------------------------------------------------------------
-- Correction workflow RPCs
-- ---------------------------------------------------------------------------
create or replace function public.request_routed_settlement_correction(
  p_proposal_id uuid,
  p_correction_path text,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.routed_settlement_proposals%rowtype;
  v_actor uuid;
  v_id uuid;
  v_recipients uuid[];
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_reason is null or char_length(trim(p_reason)) < 3 then
    raise exception 'Reason required';
  end if;
  if p_correction_path not in (
    'external_payment_returned',
    'accounting_correction',
    'payment_confirmation_disputed',
    'administrative_correction'
  ) then
    raise exception 'Invalid correction path';
  end if;

  select * into v_p from public.routed_settlement_proposals where id = p_proposal_id for update;
  if not found then raise exception 'Proposal not found'; end if;
  if v_p.status <> 'confirmed' then
    raise exception 'Only confirmed routes can request correction';
  end if;
  if exists (
    select 1 from public.routed_settlement_correction_requests r
    where r.proposal_id = p_proposal_id
      and r.status in ('pending','awaiting_recipient','awaiting_participants','approved','applied')
  ) then
    raise exception 'A correction request already exists for this proposal';
  end if;

  v_actor := public.current_membership_id(v_p.household_id);
  if v_actor not in (v_p.payer_membership_id, v_p.intermediary_membership_id, v_p.recipient_membership_id)
     and not public._is_financial_coordinator(v_p.household_id) then
    raise exception 'Not authorized to request correction';
  end if;
  -- Administrative path still requires a participant confirmation cycle; coordinator alone cannot apply.
  if p_correction_path = 'administrative_correction'
     and not public._is_financial_coordinator(v_p.household_id)
     and v_actor not in (v_p.payer_membership_id, v_p.intermediary_membership_id, v_p.recipient_membership_id) then
    raise exception 'Not authorized for administrative correction';
  end if;

  insert into public.routed_settlement_correction_requests (
    proposal_id, household_id, requested_by_membership_id, correction_path, reason, status
  ) values (
    p_proposal_id, v_p.household_id, v_actor, p_correction_path, trim(p_reason), 'awaiting_recipient'
  ) returning id into v_id;

  insert into public.routed_settlement_events (proposal_id, household_id, event_type, actor_membership_id, detail)
  values (
    p_proposal_id, v_p.household_id, 'settlement.correction_requested', v_actor,
    jsonb_build_object('request_id', v_id, 'path', p_correction_path, 'reason', trim(p_reason))
  );

  select array_remove(array[
    public._membership_user_id(v_p.payer_membership_id),
    public._membership_user_id(v_p.intermediary_membership_id),
    public._membership_user_id(v_p.recipient_membership_id)
  ], null) into v_recipients;

  if v_recipients is not null and cardinality(v_recipients) > 0 then
    perform public._emit_notification_event(
      v_p.household_id,
      'settlement.correction_requested',
      'routed_settlement',
      p_proposal_id,
      v_actor,
      jsonb_build_object('source_type', 'routed_settlement', 'source_id', p_proposal_id, 'request_id', v_id),
      'settlement.correction_requested:' || v_id::text,
      v_recipients,
      'Routed payment correction requested',
      'A participant requested reversing a confirmed routed settlement. Review in the app.',
      '/app/' || v_p.household_id::text || '/money/simplify/' || p_proposal_id::text
    );
  end if;

  return v_id;
end;
$$;

create or replace function public.respond_routed_settlement_correction(
  p_request_id uuid,
  p_decision text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.routed_settlement_correction_requests%rowtype;
  v_p public.routed_settlement_proposals%rowtype;
  v_actor uuid;
  v_role text;
  v_payer_ok boolean;
  v_intermediary_ok boolean;
  v_recipient_ok boolean;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_decision not in (
    'confirmed_return', 'declined_return', 'disputed_receipt', 'approved', 'declined'
  ) then
    raise exception 'Invalid decision';
  end if;

  select * into v_req from public.routed_settlement_correction_requests where id = p_request_id for update;
  if not found then raise exception 'Correction request not found'; end if;
  if v_req.status in ('applied', 'declined', 'disputed', 'cancelled') then
    raise exception 'Correction request is closed';
  end if;

  select * into v_p from public.routed_settlement_proposals where id = v_req.proposal_id for update;
  v_actor := public.current_membership_id(v_req.household_id);

  if v_actor = v_p.recipient_membership_id then
    v_role := 'recipient';
  elsif v_actor = v_p.payer_membership_id then
    v_role := 'payer';
  elsif v_actor = v_p.intermediary_membership_id then
    v_role := 'intermediary';
  else
    raise exception 'Only route participants may respond';
  end if;

  -- Recipient must first confirm return / decline / dispute.
  if v_req.status = 'awaiting_recipient' then
    if v_role <> 'recipient' then
      raise exception 'Recipient must confirm return, decline, or dispute first';
    end if;
    if p_decision not in ('confirmed_return', 'declined_return', 'disputed_receipt') then
      raise exception 'Recipient must choose confirmed_return, declined_return, or disputed_receipt';
    end if;

    update public.routed_settlement_correction_requests
    set recipient_decision = p_decision,
        recipient_decided_at = now(),
        status = case
          when p_decision = 'confirmed_return' then 'awaiting_participants'
          when p_decision = 'declined_return' then 'declined'
          else 'disputed'
        end,
        updated_at = now()
    where id = p_request_id;

    insert into public.routed_settlement_correction_responses (
      request_id, household_id, membership_id, role, decision, note
    ) values (
      p_request_id, v_req.household_id, v_actor, 'recipient',
      case when p_decision = 'confirmed_return' then 'approved' else 'declined' end,
      p_note
    );

    insert into public.routed_settlement_events (proposal_id, household_id, event_type, actor_membership_id, detail)
    values (
      v_p.id, v_p.household_id, 'settlement.correction_recipient_decision', v_actor,
      jsonb_build_object('request_id', p_request_id, 'decision', p_decision)
    );

    if p_decision = 'confirmed_return' then
      -- Auto-record recipient approval toward consensus; continue below to maybe apply.
      null;
    else
      return;
    end if;
  elsif v_req.status = 'awaiting_participants' then
    if v_role = 'recipient' then
      raise exception 'Recipient already responded';
    end if;
    if p_decision not in ('approved', 'declined') then
      raise exception 'Participants must approve or decline';
    end if;

    insert into public.routed_settlement_correction_responses (
      request_id, household_id, membership_id, role, decision, note
    ) values (
      p_request_id, v_req.household_id, v_actor, v_role, p_decision, p_note
    )
    on conflict (request_id, membership_id, role) do update
      set decision = excluded.decision,
          note = excluded.note;

    if p_decision = 'declined' then
      update public.routed_settlement_correction_requests
      set status = 'declined', updated_at = now()
      where id = p_request_id;
      return;
    end if;
  else
    raise exception 'Correction request is not awaiting responses';
  end if;

  -- Refresh and check consensus: recipient confirmed return + payer + intermediary approved.
  select * into v_req from public.routed_settlement_correction_requests where id = p_request_id;
  if v_req.status <> 'awaiting_participants' then
    return;
  end if;

  select exists (
    select 1 from public.routed_settlement_correction_responses r
    where r.request_id = p_request_id and r.role = 'payer' and r.decision = 'approved'
  ) into v_payer_ok;
  select exists (
    select 1 from public.routed_settlement_correction_responses r
    where r.request_id = p_request_id and r.role = 'intermediary' and r.decision = 'approved'
  ) into v_intermediary_ok;
  select exists (
    select 1 from public.routed_settlement_correction_responses r
    where r.request_id = p_request_id and r.role = 'recipient' and r.decision = 'approved'
  ) into v_recipient_ok;

  if v_payer_ok and v_intermediary_ok and v_recipient_ok then
    update public.routed_settlement_correction_requests
    set status = 'approved', updated_at = now()
    where id = p_request_id;
    perform public.apply_routed_settlement_correction(p_request_id);
  end if;
end;
$$;

create or replace function public.apply_routed_settlement_correction(
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.routed_settlement_correction_requests%rowtype;
  v_p public.routed_settlement_proposals%rowtype;
  v_payment public.payments%rowtype;
  v_reversal_id uuid;
  v_actor uuid;
  v_recipients uuid[];
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform set_config('householdos.payment_mutation', 'rpc', true);

  select * into v_req from public.routed_settlement_correction_requests where id = p_request_id for update;
  if not found then raise exception 'Correction request not found'; end if;
  if v_req.status = 'applied' then
    return; -- idempotent
  end if;
  if v_req.status <> 'approved' then
    raise exception 'Correction is not approved';
  end if;
  -- Restoring both legs is only valid when the recipient confirms the money was returned.
  if v_req.recipient_decision is distinct from 'confirmed_return' then
    raise exception 'Recipient must confirm the external payment was returned before restoring obligations';
  end if;

  select * into v_p from public.routed_settlement_proposals where id = v_req.proposal_id for update;
  if v_p.status <> 'confirmed' then
    raise exception 'Proposal is not confirmed';
  end if;
  if v_p.payment_id is null then
    raise exception 'Confirmed route is missing linked payment';
  end if;

  select * into v_payment from public.payments where id = v_p.payment_id for update;
  if not found then raise exception 'Linked payment not found'; end if;
  if v_payment.status = 'reversed' or exists (
    select 1 from public.payment_reversals where payment_id = v_payment.id
  ) then
    raise exception 'Linked payment already reversed';
  end if;
  if v_payment.status <> 'confirmed' then
    raise exception 'Linked payment is not confirmed';
  end if;

  v_actor := public.current_membership_id(v_p.household_id);

  perform 1 from public.reimbursement_obligations
  where id = v_p.source_obligation_ab_id for update;
  perform 1 from public.reimbursement_obligations
  where id = v_p.source_obligation_bc_id for update;

  insert into public.payment_reversals (
    payment_id, household_id, reversed_by_membership_id, reason
  ) values (
    v_payment.id,
    v_p.household_id,
    v_actor,
    'Routed settlement correction: ' || v_req.reason
  ) returning id into v_reversal_id;

  update public.payments
  set status = 'reversed',
      reversed_at = now(),
      updated_at = now()
  where id = v_payment.id;

  update public.reimbursement_obligations
  set current_amount_cents = current_amount_cents + v_p.amount_cents,
      updated_at = now()
  where id in (v_p.source_obligation_ab_id, v_p.source_obligation_bc_id);

  perform public._sync_obligation_settlement_status(v_p.source_obligation_ab_id);
  perform public._sync_obligation_settlement_status(v_p.source_obligation_bc_id);

  update public.routed_settlement_proposals
  set status = 'reversed', updated_at = now()
  where id = v_p.id;

  update public.routed_settlement_correction_requests
  set status = 'applied',
      payment_reversal_id = v_reversal_id,
      applied_at = now(),
      updated_at = now()
  where id = p_request_id;

  insert into public.routed_settlement_events (proposal_id, household_id, event_type, actor_membership_id, detail)
  values (
    v_p.id, v_p.household_id, 'settlement.correction_applied', v_actor,
    jsonb_build_object(
      'request_id', p_request_id,
      'payment_id', v_payment.id,
      'payment_reversal_id', v_reversal_id,
      'path', v_req.correction_path
    )
  );

  select array_remove(array[
    public._membership_user_id(v_p.payer_membership_id),
    public._membership_user_id(v_p.intermediary_membership_id),
    public._membership_user_id(v_p.recipient_membership_id)
  ], null) into v_recipients;

  if v_recipients is not null and cardinality(v_recipients) > 0 then
    perform public._emit_notification_event(
      v_p.household_id,
      'settlement.route_reversed',
      'routed_settlement',
      v_p.id,
      v_actor,
      jsonb_build_object('source_type', 'routed_settlement', 'source_id', v_p.id, 'request_id', p_request_id),
      'settlement.correction_applied:' || p_request_id::text,
      v_recipients,
      'Routed payment correction applied',
      'The linked external payment was reversed and both obligation legs were restored.',
      '/app/' || v_p.household_id::text || '/money/simplify/' || v_p.id::text
    );
  end if;
end;
$$;

revoke all on function public.request_routed_settlement_correction(uuid, text, text) from public;
revoke all on function public.respond_routed_settlement_correction(uuid, text, text) from public;
revoke all on function public.apply_routed_settlement_correction(uuid) from public;
revoke all on function public.reverse_routed_settlement(uuid, text) from public;

grant execute on function public.request_routed_settlement_correction(uuid, text, text) to authenticated;
grant execute on function public.respond_routed_settlement_correction(uuid, text, text) to authenticated;
-- apply is invoked from respond when consensus is reached; still grant for explicit retry after approval
grant execute on function public.apply_routed_settlement_correction(uuid) to authenticated;
-- Keep reverse callable so clients get a clear error instead of "function not found"
grant execute on function public.reverse_routed_settlement(uuid, text) to authenticated;
