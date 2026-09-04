-- Receipt claiming lifecycle, upload recovery, and roommate-facing split workflows.
-- Does not rewrite existing expense history.

-- =============================================================================
-- Schema
-- =============================================================================

alter table public.expense_receipts
  drop constraint if exists expense_receipts_status_check;

alter table public.expense_receipts
  add constraint expense_receipts_status_check
  check (status in (
    'uploaded','extracting','needs_review','claiming','ready_for_review',
    'confirmed','rejected','failed'
  ));

alter table public.expense_receipts
  drop constraint if exists expense_receipts_size_bytes_check;

alter table public.expense_receipts
  add constraint expense_receipts_size_bytes_check
  check (size_bytes > 0 and size_bytes <= 20971520);

alter table public.expense_receipts
  add column if not exists payer_membership_id uuid
    references public.household_memberships(id) on delete restrict,
  add column if not exists split_workflow text
    check (split_workflow is null or split_workflow in (
      'equal_all','assign_items','claiming'
    )),
  add column if not exists split_membership_ids uuid[] not null default '{}',
  add column if not exists claim_wait_mode text
    check (claim_wait_mode is null or claim_wait_mode in (
      'wait_for_everyone','finish_now'
    )),
  add column if not exists ocr_outcome text
    check (ocr_outcome is null or ocr_outcome in (
      'pending','succeeded','failed','manual','timeout'
    )),
  add column if not exists register_idempotency_key text,
  add column if not exists last_split_workflow text;

update public.expense_receipts
set payer_membership_id = uploaded_by_membership_id
where payer_membership_id is null;

create unique index if not exists expense_receipts_register_idempotency_uidx
  on public.expense_receipts(household_id, register_idempotency_key)
  where register_idempotency_key is not null and deleted_at is null;

create table if not exists public.expense_receipt_orphan_cleanups (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  storage_path text not null,
  reason text not null,
  cleaned boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.expense_receipt_orphan_cleanups enable row level security;

create policy expense_receipt_orphan_cleanups_no_client on public.expense_receipt_orphan_cleanups
  for all to authenticated using (false) with check (false);

create table if not exists public.expense_receipt_claim_invites (
  receipt_id uuid not null,
  household_id uuid not null,
  membership_id uuid not null references public.household_memberships(id) on delete restrict,
  status text not null default 'waiting' check (status in ('waiting','claimed','skipped')),
  responded_at timestamptz,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (receipt_id, membership_id),
  foreign key (receipt_id, household_id)
    references public.expense_receipts(id, household_id) on delete cascade
);

create index if not exists expense_receipt_claim_invites_member_idx
  on public.expense_receipt_claim_invites(household_id, membership_id, status);

create table if not exists public.expense_receipt_line_claims (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  receipt_id uuid not null,
  line_item_id uuid not null,
  membership_id uuid not null references public.household_memberships(id) on delete restrict,
  claim_kind text not null check (claim_kind in (
    'mine','assigned','shared','household','excluded','quantity'
  )),
  quantity numeric not null default 1 check (quantity > 0),
  amount_cents int,
  idempotency_key text,
  retracted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (receipt_id, household_id)
    references public.expense_receipts(id, household_id) on delete cascade,
  foreign key (line_item_id, household_id)
    references public.expense_receipt_line_items(id, household_id) on delete cascade
);

create unique index if not exists expense_receipt_line_claims_active_uidx
  on public.expense_receipt_line_claims(line_item_id, membership_id)
  where retracted_at is null;

create unique index if not exists expense_receipt_line_claims_idempotency_uidx
  on public.expense_receipt_line_claims(idempotency_key)
  where idempotency_key is not null;

create table if not exists public.expense_receipt_claim_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  receipt_id uuid not null,
  line_item_id uuid,
  actor_membership_id uuid not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (receipt_id, household_id)
    references public.expense_receipts(id, household_id) on delete cascade
);

create index if not exists expense_receipt_claim_events_receipt_idx
  on public.expense_receipt_claim_events(receipt_id, created_at);

create trigger expense_receipt_line_claims_set_updated_at
  before update on public.expense_receipt_line_claims
  for each row execute function public.set_updated_at();

alter table public.expense_receipt_claim_invites enable row level security;
alter table public.expense_receipt_line_claims enable row level security;
alter table public.expense_receipt_claim_events enable row level security;

-- =============================================================================
-- Authorization helpers
-- =============================================================================

create or replace function public.can_view_expense_receipt(p_receipt_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.expense_receipts r
    where r.id = p_receipt_id
      and r.deleted_at is null
      and public.is_active_member(r.household_id)
      and (
        r.uploaded_by_membership_id = public.current_membership_id(r.household_id)
        or r.payer_membership_id = public.current_membership_id(r.household_id)
        or public._is_financial_coordinator(r.household_id)
        or exists (
          select 1
          from public.expense_receipt_claim_invites i
          where i.receipt_id = r.id
            and i.membership_id = public.current_membership_id(r.household_id)
        )
        or (
          r.expense_id is not null
          and exists (
            select 1
            from public.expenses e
            where e.id = r.expense_id
              and e.household_id = r.household_id
              and (
                e.created_by_membership_id = public.current_membership_id(r.household_id)
                or e.payer_membership_id = public.current_membership_id(r.household_id)
                or exists (
                  select 1
                  from public.expense_item_allocations a
                  where a.expense_id = e.id
                    and a.membership_id = public.current_membership_id(r.household_id)
                )
              )
          )
        )
      )
  );
$$;

create or replace function public.can_claim_expense_receipt(p_receipt_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.expense_receipts r
    where r.id = p_receipt_id
      and r.deleted_at is null
      and r.status = 'claiming'
      and public.is_active_member(r.household_id)
      and (
        r.uploaded_by_membership_id = public.current_membership_id(r.household_id)
        or r.payer_membership_id = public.current_membership_id(r.household_id)
        or public._is_financial_coordinator(r.household_id)
        or exists (
          select 1
          from public.expense_receipt_claim_invites i
          where i.receipt_id = r.id
            and i.membership_id = public.current_membership_id(r.household_id)
        )
      )
  );
$$;

revoke all on function public.can_claim_expense_receipt(uuid) from public, anon;
grant execute on function public.can_claim_expense_receipt(uuid) to authenticated;

create policy expense_receipt_claim_invites_select on public.expense_receipt_claim_invites
  for select to authenticated
  using (public.can_view_expense_receipt(receipt_id));
create policy expense_receipt_claim_invites_no_write on public.expense_receipt_claim_invites
  for all to authenticated using (false) with check (false);

create policy expense_receipt_line_claims_select on public.expense_receipt_line_claims
  for select to authenticated
  using (public.can_view_expense_receipt(receipt_id));
create policy expense_receipt_line_claims_no_write on public.expense_receipt_line_claims
  for all to authenticated using (false) with check (false);

create policy expense_receipt_claim_events_select on public.expense_receipt_claim_events
  for select to authenticated
  using (public.can_view_expense_receipt(receipt_id));
create policy expense_receipt_claim_events_no_write on public.expense_receipt_claim_events
  for all to authenticated using (false) with check (false);

-- =============================================================================
-- Notification meta: receipt.* joins the money category
-- =============================================================================

create or replace function public._notification_meta_for_event_type(p_event_type text)
returns table (
  category text,
  urgency text,
  action_oriented boolean
)
language sql
immutable
as $$
  select
    case
      when p_event_type like 'dispute.%' then 'disputes'
      when p_event_type like 'payment.%'
        or p_event_type like 'waiver.%'
        or p_event_type like 'refund_obligation.%'
        or p_event_type like 'expense.%'
        or p_event_type like 'receipt.%'
        or p_event_type like 'settlement.%'
        or p_event_type like 'opening_balance.%' then 'payments'
      when p_event_type like 'membership.%' then 'membership'
      when p_event_type like 'chore.%' then 'chores'
      when p_event_type like 'calendar.%' then 'calendar'
      when p_event_type like 'inventory.%'
        or p_event_type like 'pantry.%'
        or p_event_type like 'shopping.%'
        or p_event_type like 'house.%' then 'house'
      when p_event_type like 'recipe.%'
        or p_event_type like 'meal.%'
        or p_event_type like 'meal_prep.%'
        or p_event_type like 'meal_batch.%' then 'meals'
      when p_event_type like 'maintenance.%' then 'maintenance'
      when p_event_type like 'governance.%'
        or p_event_type like 'agreement.%' then 'agreements'
      when p_event_type like 'system.%' then 'system'
      else 'system'
    end,
    case
      when p_event_type in (
        'payment.awaiting_confirmation',
        'payment.rejected',
        'payment.reversed',
        'waiver.reversed',
        'dispute.opened',
        'refund_obligation.created',
        'expense.voided',
        'receipt.claiming_started',
        'receipt.claim_requested',
        'receipt.ready_for_payer_review',
        'meal.cancelled',
        'meal.shopping_needed',
        'maintenance.reported',
        'maintenance.severity_changed',
        'maintenance.appointment_scheduled',
        'calendar.sync_failure',
        'calendar.external_auth_expired',
        'calendar.conflict_introduced',
        'settlement.intermediary_approval_required',
        'settlement.recipient_acceptance_required',
        'settlement.route_stale',
        'settlement.route_reversed'
      ) then 'high'
      when p_event_type like 'system.%urgent%'
        or p_event_type = 'maintenance.reopened' then 'urgent'
      else 'normal'
    end,
    case
      when p_event_type in (
        'payment.awaiting_confirmation',
        'payment.rejected',
        'waiver.created',
        'waiver.reversed',
        'dispute.opened',
        'refund_obligation.created',
        'expense.voided',
        'expense.amended',
        'receipt.claiming_started',
        'receipt.claim_requested',
        'receipt.ready_for_payer_review',
        'receipt.claim_reminder',
        'meal.rsvp_requested',
        'meal.shopping_needed',
        'meal.cleanup_assigned',
        'maintenance.assigned',
        'maintenance.waiting_on_household',
        'maintenance.appointment_scheduled',
        'maintenance.vendor_response_needed',
        'calendar.invitation',
        'calendar.event_requires_reconfirm',
        'calendar.availability_request',
        'calendar.sync_failure',
        'calendar.external_auth_expired',
        'calendar.conflict_introduced',
        'settlement.intermediary_approval_required',
        'settlement.recipient_acceptance_required',
        'settlement.ready_to_pay',
        'settlement.payment_submitted',
        'opening_balance.confirmation_required'
      ) then true
      else false
    end;
$$;

revoke all on function public._notification_meta_for_event_type(text) from public;

-- =============================================================================
-- Upload registration with idempotency + orphan tracking
-- =============================================================================

create or replace function public.record_receipt_orphan_cleanup(
  p_household_id uuid,
  p_storage_path text,
  p_reason text,
  p_cleaned boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.expense_receipt_orphan_cleanups (
    household_id, storage_path, reason, cleaned
  ) values (
    p_household_id, p_storage_path, left(coalesce(p_reason, 'unknown'), 500), p_cleaned
  );
end;
$$;

revoke all on function public.record_receipt_orphan_cleanup(uuid, text, text, boolean) from public;
grant execute on function public.record_receipt_orphan_cleanup(uuid, text, text, boolean) to authenticated;

drop function if exists public.register_expense_receipt(uuid, text, text, text, int, text, text);

create function public.register_expense_receipt(
  p_household_id uuid,
  p_storage_path text,
  p_mime_type text,
  p_file_name text,
  p_size_bytes int,
  p_file_hash text default null,
  p_perceptual_hash text default null,
  p_idempotency_key text default null
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

  if p_idempotency_key is not null and length(trim(p_idempotency_key)) >= 8 then
    select id into v_id
    from public.expense_receipts
    where household_id = p_household_id
      and register_idempotency_key = p_idempotency_key
      and deleted_at is null;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  insert into public.expense_receipts (
    household_id, uploaded_by_membership_id, payer_membership_id, storage_path, mime_type,
    file_name, size_bytes, file_hash, perceptual_hash, status, ocr_outcome,
    register_idempotency_key
  ) values (
    p_household_id, v_membership_id, v_membership_id, p_storage_path, p_mime_type,
    p_file_name, p_size_bytes, p_file_hash, p_perceptual_hash, 'uploaded', 'pending',
    nullif(trim(coalesce(p_idempotency_key, '')), '')
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

revoke all on function public.register_expense_receipt(uuid, text, text, text, int, text, text, text) from public;
grant execute on function public.register_expense_receipt(uuid, text, text, text, int, text, text, text) to authenticated;

create or replace function public.mark_receipt_ocr_outcome(
  p_receipt_id uuid,
  p_outcome text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.can_edit_expense_receipt(p_receipt_id) then
    raise exception 'Not authorized';
  end if;
  if p_outcome not in ('pending','succeeded','failed','manual','timeout') then
    raise exception 'Invalid OCR outcome';
  end if;
  update public.expense_receipts
  set ocr_outcome = p_outcome,
      status = case
        when status in ('confirmed','claiming','ready_for_review') then status
        when p_outcome in ('failed','manual','timeout','succeeded') then 'needs_review'
        else status
      end,
      updated_at = now()
  where id = p_receipt_id
    and deleted_at is null;
end;
$$;

revoke all on function public.mark_receipt_ocr_outcome(uuid, text) from public;
grant execute on function public.mark_receipt_ocr_outcome(uuid, text) to authenticated;

-- OCR extraction failure must leave a reviewable draft, not a dead receipt.
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
  set status = case when p_error is not null then 'failed' else 'succeeded' end,
      last_error = p_error,
      updated_at = now()
  where receipt_id = p_receipt_id and status = 'claimed';

  if p_error is not null then
    update public.expense_receipts
    set status = 'needs_review',
        ocr_outcome = 'failed',
        updated_at = now()
    where id = p_receipt_id;
    return;
  end if;

  insert into public.expense_receipt_extractions (
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
      ocr_outcome = 'succeeded',
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

-- =============================================================================
-- Claim helpers
-- =============================================================================

create or replace function public._receipt_line_quantity(p_quantity numeric)
returns numeric
language sql
immutable
as $$
  select case
    when p_quantity is null or p_quantity <= 0 then 1
    else round(p_quantity)
  end;
$$;

create or replace function public._receipt_claimed_quantity(p_line_item_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(c.quantity), 0)
  from public.expense_receipt_line_claims c
  where c.line_item_id = p_line_item_id
    and c.retracted_at is null
    and c.claim_kind in ('mine','assigned','quantity');
$$;

create or replace function public._append_receipt_claim_event(
  p_household_id uuid,
  p_receipt_id uuid,
  p_line_item_id uuid,
  p_actor uuid,
  p_event_type text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.expense_receipt_claim_events (
    household_id, receipt_id, line_item_id, actor_membership_id, event_type, payload
  ) values (
    p_household_id, p_receipt_id, p_line_item_id, p_actor, p_event_type, coalesce(p_payload, '{}'::jsonb)
  );
end;
$$;

create or replace function public._receipt_invite_user_ids(p_receipt_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(m.user_id), '{}'::uuid[])
  from public.expense_receipt_claim_invites i
  join public.household_memberships m on m.id = i.membership_id
  join public.expense_receipts r on r.id = i.receipt_id
  where i.receipt_id = p_receipt_id
    and m.status = 'active'
    and m.household_id = r.household_id
    and m.id is distinct from r.payer_membership_id
    and m.id is distinct from r.uploaded_by_membership_id;
$$;

-- =============================================================================
-- Claim RPCs
-- =============================================================================

create or replace function public.start_receipt_claiming(
  p_receipt_id uuid,
  p_invite_membership_ids uuid[] default null,
  p_wait_mode text default 'wait_for_everyone'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt public.expense_receipts%rowtype;
  v_actor uuid;
  v_ids uuid[];
  v_mid uuid;
  v_recipients uuid[];
  v_merchant text;
  v_payer_name text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_receipt from public.expense_receipts where id = p_receipt_id for update;
  if not found or v_receipt.deleted_at is not null then
    raise exception 'Receipt not found';
  end if;
  if not public.can_edit_expense_receipt(p_receipt_id) then
    raise exception 'Not authorized to start claiming';
  end if;
  if v_receipt.status = 'confirmed' then
    raise exception 'Receipt already confirmed';
  end if;
  if v_receipt.status = 'claiming' then
    return;
  end if;
  if v_receipt.status not in ('needs_review','ready_for_review','uploaded','extracting','failed') then
    raise exception 'Receipt is not claimable';
  end if;
  v_actor := public.current_membership_id(v_receipt.household_id);

  if p_invite_membership_ids is null or coalesce(array_length(p_invite_membership_ids, 1), 0) = 0 then
    select coalesce(array_agg(m.id), '{}'::uuid[])
    into v_ids
    from public.household_memberships m
    where m.household_id = v_receipt.household_id
      and m.status = 'active';
  else
    select coalesce(array_agg(m.id), '{}'::uuid[])
    into v_ids
    from public.household_memberships m
    where m.household_id = v_receipt.household_id
      and m.status = 'active'
      and m.id = any(p_invite_membership_ids);
  end if;

  delete from public.expense_receipt_claim_invites where receipt_id = p_receipt_id;
  foreach v_mid in array v_ids
  loop
    insert into public.expense_receipt_claim_invites (
      receipt_id, household_id, membership_id, status
    ) values (
      p_receipt_id, v_receipt.household_id, v_mid,
      case when v_mid = v_actor then 'claimed' else 'waiting' end
    );
  end loop;

  update public.expense_receipts
  set status = 'claiming',
      split_workflow = 'claiming',
      last_split_workflow = 'claiming',
      claim_wait_mode = case
        when p_wait_mode in ('wait_for_everyone','finish_now') then p_wait_mode
        else 'wait_for_everyone'
      end,
      payer_membership_id = coalesce(payer_membership_id, uploaded_by_membership_id),
      updated_at = now()
  where id = p_receipt_id;

  perform public._append_receipt_claim_event(
    v_receipt.household_id, p_receipt_id, null, v_actor, 'claiming_started', '{}'::jsonb
  );

  v_recipients := public._receipt_invite_user_ids(p_receipt_id);
  v_merchant := coalesce(nullif(v_receipt.merchant_corrected, ''), 'Receipt');
  select coalesce(p.display_name, p.email, 'Roommate')
  into v_payer_name
  from public.household_memberships m
  join public.profiles p on p.id = m.user_id
  where m.id = coalesce(v_receipt.payer_membership_id, v_receipt.uploaded_by_membership_id);

  if coalesce(array_length(v_recipients, 1), 0) > 0 then
    perform public._emit_notification_event(
      v_receipt.household_id,
      'receipt.claiming_started',
      'expense_receipt',
      p_receipt_id,
      v_actor,
      jsonb_build_object('merchant', left(v_merchant, 80)),
      'receipt.claiming_started:' || p_receipt_id::text,
      v_recipients,
      v_merchant || ' receipt needs your items',
      coalesce(v_payer_name, 'A roommate') || ' paid. Select anything that belongs to you.',
      '/app/' || v_receipt.household_id::text || '/money/receipts/' || p_receipt_id::text || '?claim=1'
    );
  end if;
end;
$$;

create or replace function public.claim_receipt_line(
  p_line_item_id uuid,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.claim_receipt_line_quantity(p_line_item_id, 1, p_idempotency_key);
end;
$$;

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

  select * into v_line
  from public.expense_receipt_line_items
  where id = p_line_item_id
  for update;
  if not found then raise exception 'Line not found'; end if;

  select * into v_receipt
  from public.expense_receipts
  where id = v_line.receipt_id
  for update;
  if not found or v_receipt.deleted_at is not null then
    raise exception 'Receipt not found';
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

create or replace function public.unclaim_receipt_line(
  p_line_item_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line public.expense_receipt_line_items%rowtype;
  v_receipt public.expense_receipts%rowtype;
  v_actor uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_line from public.expense_receipt_line_items where id = p_line_item_id for update;
  if not found then raise exception 'Line not found'; end if;
  select * into v_receipt from public.expense_receipts where id = v_line.receipt_id for update;
  if v_receipt.status = 'confirmed' then raise exception 'CLAIM_FINALIZED'; end if;
  if not public.can_claim_expense_receipt(v_receipt.id)
     and not public.can_edit_expense_receipt(v_receipt.id) then
    raise exception 'Not authorized';
  end if;
  v_actor := public.current_membership_id(v_receipt.household_id);

  update public.expense_receipt_line_claims
  set retracted_at = now()
  where line_item_id = p_line_item_id
    and membership_id = v_actor
    and retracted_at is null;

  if not exists (
    select 1 from public.expense_receipt_line_claims
    where line_item_id = p_line_item_id and retracted_at is null
  ) then
    update public.expense_receipt_line_items
    set classification = 'needs_review',
        participant_membership_ids = '{}',
        review_status = 'pending',
        updated_at = now()
    where id = p_line_item_id;
  end if;

  perform public._append_receipt_claim_event(
    v_receipt.household_id, v_receipt.id, p_line_item_id, v_actor, 'unclaimed', '{}'::jsonb
  );
end;
$$;

create or replace function public.mark_receipt_line_shared(
  p_line_item_id uuid,
  p_membership_ids uuid[] default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line public.expense_receipt_line_items%rowtype;
  v_receipt public.expense_receipts%rowtype;
  v_actor uuid;
  v_ids uuid[];
  v_mid uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_line from public.expense_receipt_line_items where id = p_line_item_id for update;
  if not found then raise exception 'Line not found'; end if;
  select * into v_receipt from public.expense_receipts where id = v_line.receipt_id for update;
  if v_receipt.status = 'confirmed' then raise exception 'CLAIM_FINALIZED'; end if;
  if not public.can_edit_expense_receipt(v_receipt.id)
     and not public.can_claim_expense_receipt(v_receipt.id) then
    raise exception 'Not authorized';
  end if;
  v_actor := public.current_membership_id(v_receipt.household_id);

  if p_membership_ids is null or coalesce(array_length(p_membership_ids, 1), 0) = 0 then
    select coalesce(array_agg(m.id), '{}'::uuid[])
    into v_ids
    from public.household_memberships m
    where m.household_id = v_receipt.household_id and m.status = 'active';
  else
    select coalesce(array_agg(m.id), '{}'::uuid[])
    into v_ids
    from public.household_memberships m
    where m.household_id = v_receipt.household_id
      and m.status = 'active'
      and m.id = any(p_membership_ids);
    if coalesce(array_length(v_ids, 1), 0) = 0 then
      raise exception 'No valid household members selected';
    end if;
  end if;

  update public.expense_receipt_line_claims
  set retracted_at = now()
  where line_item_id = p_line_item_id and retracted_at is null;

  foreach v_mid in array v_ids
  loop
    insert into public.expense_receipt_line_claims (
      household_id, receipt_id, line_item_id, membership_id, claim_kind, quantity
    ) values (
      v_receipt.household_id, v_receipt.id, p_line_item_id, v_mid, 'shared', 1
    );
  end loop;

  update public.expense_receipt_line_items
  set classification = case
        when coalesce(array_length(v_ids, 1), 0) = (
          select count(*) from public.household_memberships m
          where m.household_id = v_receipt.household_id and m.status = 'active'
        ) then 'shared_household'
        else 'shared_selected'
      end,
      participant_membership_ids = v_ids,
      review_status = 'corrected',
      updated_at = now()
  where id = p_line_item_id;

  perform public._append_receipt_claim_event(
    v_receipt.household_id, v_receipt.id, p_line_item_id, v_actor, 'shared',
    jsonb_build_object('members', to_jsonb(v_ids))
  );
end;
$$;

create or replace function public.assign_receipt_line(
  p_line_item_id uuid,
  p_membership_id uuid,
  p_excluded boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line public.expense_receipt_line_items%rowtype;
  v_receipt public.expense_receipts%rowtype;
  v_actor uuid;
  v_payer uuid;
  v_ok boolean;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_line from public.expense_receipt_line_items where id = p_line_item_id for update;
  if not found then raise exception 'Line not found'; end if;
  select * into v_receipt from public.expense_receipts where id = v_line.receipt_id for update;
  if v_receipt.status = 'confirmed' then raise exception 'CLAIM_FINALIZED'; end if;
  if not public.can_edit_expense_receipt(v_receipt.id) then
    raise exception 'Not authorized to assign this item';
  end if;
  v_actor := public.current_membership_id(v_receipt.household_id);
  v_payer := coalesce(v_receipt.payer_membership_id, v_receipt.uploaded_by_membership_id);

  update public.expense_receipt_line_claims
  set retracted_at = now()
  where line_item_id = p_line_item_id and retracted_at is null;

  if p_excluded then
    insert into public.expense_receipt_line_claims (
      household_id, receipt_id, line_item_id, membership_id, claim_kind, quantity
    ) values (
      v_receipt.household_id, v_receipt.id, p_line_item_id, v_actor, 'excluded', 1
    );
    update public.expense_receipt_line_items
    set classification = 'excluded',
        participant_membership_ids = '{}',
        review_status = 'excluded',
        updated_at = now()
    where id = p_line_item_id;
  else
    select exists (
      select 1 from public.household_memberships m
      where m.id = p_membership_id
        and m.household_id = v_receipt.household_id
        and m.status = 'active'
    ) into v_ok;
    if not v_ok then raise exception 'Not an active household member'; end if;

    insert into public.expense_receipt_line_claims (
      household_id, receipt_id, line_item_id, membership_id, claim_kind, quantity
    ) values (
      v_receipt.household_id, v_receipt.id, p_line_item_id, p_membership_id, 'assigned', 1
    );
    update public.expense_receipt_line_items
    set classification = case
          when p_membership_id = v_payer then 'personal_purchaser'
          else 'personal_other'
        end,
        participant_membership_ids = array[p_membership_id],
        review_status = 'corrected',
        updated_at = now()
    where id = p_line_item_id;
  end if;

  perform public._append_receipt_claim_event(
    v_receipt.household_id, v_receipt.id, p_line_item_id, v_actor, 'assigned',
    jsonb_build_object('membership_id', p_membership_id, 'excluded', p_excluded)
  );
end;
$$;

create or replace function public.finish_receipt_claiming(
  p_receipt_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt public.expense_receipts%rowtype;
  v_actor uuid;
  v_payer_user uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_receipt from public.expense_receipts where id = p_receipt_id for update;
  if not found then raise exception 'Receipt not found'; end if;
  if not public.can_claim_expense_receipt(p_receipt_id)
     and not public.can_edit_expense_receipt(p_receipt_id) then
    raise exception 'Not authorized';
  end if;
  if v_receipt.status = 'confirmed' then raise exception 'CLAIM_FINALIZED'; end if;
  v_actor := public.current_membership_id(v_receipt.household_id);

  update public.expense_receipt_claim_invites
  set status = 'claimed',
      responded_at = coalesce(responded_at, now())
  where receipt_id = p_receipt_id
    and membership_id = v_actor;

  if not exists (
    select 1 from public.expense_receipt_claim_invites
    where receipt_id = p_receipt_id and status = 'waiting'
  ) then
    update public.expense_receipts
    set status = 'ready_for_review', updated_at = now()
    where id = p_receipt_id;

    select m.user_id into v_payer_user
    from public.household_memberships m
    where m.id = coalesce(v_receipt.payer_membership_id, v_receipt.uploaded_by_membership_id);

    if v_payer_user is not null and v_payer_user is distinct from auth.uid() then
      perform public._emit_notification_event(
        v_receipt.household_id,
        'receipt.ready_for_payer_review',
        'expense_receipt',
        p_receipt_id,
        v_actor,
        jsonb_build_object('merchant', left(coalesce(v_receipt.merchant_corrected, 'Receipt'), 80)),
        'receipt.ready_for_payer_review:' || p_receipt_id::text,
        array[v_payer_user],
        'Receipt ready to review',
        coalesce(v_receipt.merchant_corrected, 'A receipt') || ' is ready to submit.',
        '/app/' || v_receipt.household_id::text || '/money/receipts/' || p_receipt_id::text
      );
    end if;
  else
    select m.user_id into v_payer_user
    from public.household_memberships m
    where m.id = coalesce(v_receipt.payer_membership_id, v_receipt.uploaded_by_membership_id);
    if v_payer_user is not null and v_payer_user is distinct from auth.uid() then
      perform public._emit_notification_event(
        v_receipt.household_id,
        'receipt.claim_completed',
        'expense_receipt',
        p_receipt_id,
        v_actor,
        jsonb_build_object('merchant', left(coalesce(v_receipt.merchant_corrected, 'Receipt'), 80)),
        'receipt.claim_completed:' || p_receipt_id::text || ':' || v_actor::text,
        array[v_payer_user],
        'A roommate finished claiming items',
        'Open the receipt when you are ready to review.',
        '/app/' || v_receipt.household_id::text || '/money/receipts/' || p_receipt_id::text
      );
    end if;
  end if;

  perform public._append_receipt_claim_event(
    v_receipt.household_id, p_receipt_id, null, v_actor, 'member_finished', '{}'::jsonb
  );
end;
$$;

create or replace function public.finalize_receipt_claims(
  p_receipt_id uuid,
  p_force boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt public.expense_receipts%rowtype;
  v_waiting int;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_receipt from public.expense_receipts where id = p_receipt_id for update;
  if not found then raise exception 'Receipt not found'; end if;
  if not public.can_edit_expense_receipt(p_receipt_id) then
    raise exception 'Not authorized';
  end if;
  if v_receipt.status = 'confirmed' then raise exception 'CLAIM_FINALIZED'; end if;

  select count(*) into v_waiting
  from public.expense_receipt_claim_invites
  where receipt_id = p_receipt_id and status = 'waiting';

  if v_waiting > 0 and not coalesce(p_force, false) then
    raise exception 'WAITING_FOR_CLAIMS:%', v_waiting;
  end if;

  update public.expense_receipts
  set status = 'ready_for_review',
      claim_wait_mode = case when coalesce(p_force, false) then 'finish_now' else claim_wait_mode end,
      updated_at = now()
  where id = p_receipt_id;
end;
$$;

create or replace function public.set_receipt_split_workflow(
  p_receipt_id uuid,
  p_workflow text,
  p_membership_ids uuid[] default null,
  p_payer_membership_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt public.expense_receipts%rowtype;
  v_ids uuid[];
  v_payer uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_workflow not in ('equal_all','assign_items','claiming') then
    raise exception 'Invalid split workflow';
  end if;
  select * into v_receipt from public.expense_receipts where id = p_receipt_id for update;
  if not found then raise exception 'Receipt not found'; end if;
  if not public.can_edit_expense_receipt(p_receipt_id) then
    raise exception 'Not authorized';
  end if;
  if v_receipt.status = 'confirmed' then raise exception 'CLAIM_FINALIZED'; end if;

  v_payer := coalesce(p_payer_membership_id, v_receipt.payer_membership_id, v_receipt.uploaded_by_membership_id);
  if not exists (
    select 1 from public.household_memberships m
    where m.id = v_payer and m.household_id = v_receipt.household_id and m.status = 'active'
  ) then
    raise exception 'Payer must be an active household member';
  end if;

  if p_membership_ids is not null then
    select coalesce(array_agg(m.id), '{}'::uuid[])
    into v_ids
    from public.household_memberships m
    where m.household_id = v_receipt.household_id
      and m.status = 'active'
      and m.id = any(p_membership_ids);
  else
    v_ids := '{}'::uuid[];
  end if;

  update public.expense_receipts
  set split_workflow = p_workflow,
      last_split_workflow = p_workflow,
      split_membership_ids = v_ids,
      payer_membership_id = v_payer,
      status = case
        when p_workflow = 'claiming' then status
        when status in ('uploaded','extracting','failed') then 'needs_review'
        else status
      end,
      updated_at = now()
  where id = p_receipt_id;

  if p_workflow = 'equal_all' then
    update public.expense_receipt_line_items
    set classification = 'shared_selected',
        participant_membership_ids = v_ids,
        review_status = 'corrected'
    where receipt_id = p_receipt_id
      and classification <> 'excluded';
  end if;
end;
$$;

create or replace function public.apply_remaining_receipt_lines(
  p_receipt_id uuid,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt public.expense_receipts%rowtype;
  v_line record;
  v_ids uuid[];
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_action not in ('shared','mine','exclude') then
    raise exception 'Invalid remaining-item action';
  end if;
  select * into v_receipt from public.expense_receipts where id = p_receipt_id for update;
  if not found then raise exception 'Receipt not found'; end if;
  if not public.can_edit_expense_receipt(p_receipt_id) then
    raise exception 'Not authorized';
  end if;
  if v_receipt.status = 'confirmed' then raise exception 'CLAIM_FINALIZED'; end if;

  select coalesce(array_agg(m.id), '{}'::uuid[])
  into v_ids
  from public.household_memberships m
  where m.household_id = v_receipt.household_id and m.status = 'active';

  for v_line in
    select id from public.expense_receipt_line_items
    where receipt_id = p_receipt_id and classification = 'needs_review'
  loop
    if p_action = 'shared' then
      perform public.mark_receipt_line_shared(v_line.id, v_ids);
    elsif p_action = 'mine' then
      perform public.assign_receipt_line(
        v_line.id,
        public.current_membership_id(v_receipt.household_id),
        false
      );
    else
      perform public.assign_receipt_line(v_line.id, public.current_membership_id(v_receipt.household_id), true);
    end if;
  end loop;
end;
$$;

create or replace function public.remind_receipt_claiming(
  p_receipt_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt public.expense_receipts%rowtype;
  v_actor uuid;
  v_recipients uuid[];
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_receipt from public.expense_receipts where id = p_receipt_id;
  if not found then raise exception 'Receipt not found'; end if;
  if not public.can_edit_expense_receipt(p_receipt_id) then
    raise exception 'Not authorized';
  end if;
  if v_receipt.status <> 'claiming' then return; end if;
  v_actor := public.current_membership_id(v_receipt.household_id);

  select coalesce(array_agg(m.user_id), '{}'::uuid[])
  into v_recipients
  from public.expense_receipt_claim_invites i
  join public.household_memberships m on m.id = i.membership_id
  where i.receipt_id = p_receipt_id
    and i.status = 'waiting'
    and m.status = 'active'
    and (i.reminder_sent_at is null or i.reminder_sent_at < now() - interval '6 hours');

  if coalesce(array_length(v_recipients, 1), 0) = 0 then return; end if;

  update public.expense_receipt_claim_invites
  set reminder_sent_at = now()
  where receipt_id = p_receipt_id
    and status = 'waiting'
    and (reminder_sent_at is null or reminder_sent_at < now() - interval '6 hours');

  perform public._emit_notification_event(
    v_receipt.household_id,
    'receipt.claim_reminder',
    'expense_receipt',
    p_receipt_id,
    v_actor,
    jsonb_build_object('merchant', left(coalesce(v_receipt.merchant_corrected, 'Receipt'), 80)),
    'receipt.claim_reminder:' || p_receipt_id::text || ':' || to_char(now()::date, 'YYYY-MM-DD'),
    v_recipients,
    coalesce(v_receipt.merchant_corrected, 'Receipt') || ' still needs your items',
    'Select anything that belongs to you.',
    '/app/' || v_receipt.household_id::text || '/money/receipts/' || p_receipt_id::text || '?claim=1'
  );
end;
$$;

-- =============================================================================
-- Confirm as expense: honor split-everything, quantity claims, chosen payer
-- =============================================================================

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
  v_discount int;
  v_adjustments int := 0;
  v_payer uuid;
  v_qty_claims int;
  v_claim record;
  v_weight_total numeric;
  v_assigned int;
  v_floor int;
  v_frac numeric;
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
  v_payer := coalesce(v_receipt.payer_membership_id, v_receipt.uploaded_by_membership_id);

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
    v_receipt.household_id, v_membership_id, v_payer,
    coalesce(v_receipt.merchant_corrected, 'Receipt'),
    coalesce(v_receipt.purchase_date_corrected, current_date),
    'Imported from receipt',
    'other',
    v_receipt.currency,
    coalesce(v_receipt.declared_total_cents, 0),
    0, 0,
    'ready_for_review'
  ) returning id into v_expense_id;

  if v_receipt.split_workflow = 'equal_all' then
    v_item_total := coalesce(v_receipt.declared_total_cents, 0);
    v_item_subtotal := v_item_total;
    select coalesce(array_agg(m.id), '{}'::uuid[])
    into v_participants
    from unnest(coalesce(v_receipt.split_membership_ids, '{}'::uuid[])) as p(id)
    join public.household_memberships m
      on m.id = p.id
     and m.household_id = v_receipt.household_id
     and m.status = 'active';

    insert into public.expense_items (
      expense_id, household_id, description, total_cents,
      allocation_mode, classification, display_order
    ) values (
      v_expense_id, v_receipt.household_id,
      coalesce(v_receipt.merchant_corrected, 'Receipt'),
      v_item_total,
      case
        when coalesce(array_length(v_participants, 1), 0) = 0 then 'equal_all'
        else 'equal_selected'
      end,
      'shared_household',
      0
    ) returning id into v_expense_item_id;

    if coalesce(array_length(v_participants, 1), 0) > 0 then
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
  else
    for v_item in
      select * from public.expense_receipt_line_items
      where receipt_id = p_receipt_id
      order by sort_index
    loop
      select coalesce(array_agg(m.id), '{}'::uuid[])
      into v_participants
      from unnest(coalesce(v_item.participant_membership_ids, '{}'::uuid[])) as p(id)
      join public.household_memberships m
        on m.id = p.id
       and m.household_id = v_receipt.household_id
       and m.status = 'active';

      v_personal_id := null;
      v_item_total := coalesce(v_item.total_price_cents, v_item.unit_price_cents, 0);
      v_item_subtotal := v_item_subtotal + v_item_total;

      select count(*) into v_qty_claims
      from public.expense_receipt_line_claims c
      where c.line_item_id = v_item.id
        and c.retracted_at is null
        and c.claim_kind in ('mine','assigned','quantity');

      if v_qty_claims >= 2 or (v_qty_claims = 1 and public._receipt_line_quantity(v_item.quantity) > 1) then
        v_mode := 'fixed_cents';
        insert into public.expense_items (
          expense_id, household_id, description, total_cents,
          allocation_mode, classification, display_order, quantity_label
        ) values (
          v_expense_id, v_receipt.household_id,
          coalesce(v_item.corrected_name, v_item.ocr_text, 'Item'),
          v_item_total,
          'fixed_cents',
          'shared_selected',
          v_item.sort_index,
          case when v_item.quantity is null then null else v_item.quantity::text end
        ) returning id into v_expense_item_id;

        select coalesce(sum(c.quantity), 0) into v_weight_total
        from public.expense_receipt_line_claims c
        where c.line_item_id = v_item.id
          and c.retracted_at is null
          and c.claim_kind in ('mine','assigned','quantity');

        v_assigned := 0;
        for v_claim in
          select c.membership_id, c.quantity
          from public.expense_receipt_line_claims c
          join public.household_memberships m
            on m.id = c.membership_id
           and m.household_id = v_receipt.household_id
           and m.status = 'active'
          where c.line_item_id = v_item.id
            and c.retracted_at is null
            and c.claim_kind in ('mine','assigned','quantity')
          order by c.membership_id
        loop
          v_floor := floor((v_item_total * v_claim.quantity) / nullif(v_weight_total, 0));
          v_assigned := v_assigned + v_floor;
          insert into public.expense_item_allocations (
            item_id, expense_id, household_id, membership_id, amount_cents
          ) values (
            v_expense_item_id, v_expense_id, v_receipt.household_id, v_claim.membership_id, v_floor
          )
          on conflict (item_id, membership_id) do nothing;
        end loop;

        -- Distribute leftover cents by largest remainder, UUID ascending.
        for v_claim in
          select a.membership_id,
                 ((v_item_total * c.quantity) / nullif(v_weight_total, 0))
                   - floor((v_item_total * c.quantity) / nullif(v_weight_total, 0)) as frac
          from public.expense_item_allocations a
          join public.expense_receipt_line_claims c
            on c.line_item_id = v_item.id
           and c.membership_id = a.membership_id
           and c.retracted_at is null
          where a.item_id = v_expense_item_id
          order by frac desc, a.membership_id
          limit greatest(v_item_total - v_assigned, 0)
        loop
          update public.expense_item_allocations
          set amount_cents = amount_cents + 1
          where item_id = v_expense_item_id and membership_id = v_claim.membership_id;
        end loop;
      else
        v_mode := case v_item.classification
          when 'personal_purchaser' then 'personal'
          when 'personal_other' then 'personal'
          when 'shared_selected' then 'equal_selected'
          when 'excluded' then 'excluded'
          else 'equal_all'
        end;

        if v_mode = 'personal' then
          if v_item.classification = 'personal_purchaser' then
            v_personal_id := v_payer;
          elsif array_length(v_participants, 1) >= 1 then
            v_personal_id := v_participants[1];
          end if;
        elsif v_mode = 'equal_selected' and coalesce(array_length(v_participants, 1), 0) = 0 then
          v_mode := 'equal_all';
        end if;

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
      end if;

      update public.expense_receipt_line_items
      set expense_item_id = v_expense_item_id
      where id = v_item.id;
    end loop;
  end if;

  select e.proposed into v_proposed
  from public.expense_receipt_extractions e
  where e.receipt_id = p_receipt_id
  order by e.created_at desc
  limit 1;

  if v_receipt.split_workflow is distinct from 'equal_all' then
    v_discount := greatest(coalesce((v_proposed->>'discountCents')::int, 0), 0);
    v_remaining := coalesce(v_receipt.declared_total_cents, 0) - v_item_subtotal + v_discount;
    v_tax := greatest(coalesce((v_proposed->>'taxCents')::int, 0), 0);
    v_tip := greatest(coalesce((v_proposed->>'tipCents')::int, 0), 0);

    if v_discount > 0 then
      insert into public.expense_adjustments (
        expense_id, household_id, adjustment_type, description,
        amount_cents, allocation_mode, display_order
      ) values (
        v_expense_id, v_receipt.household_id, 'discount', 'Discount',
        -v_discount, 'proportional', 0
      );
      v_adjustments := v_adjustments - v_discount;
    end if;

    if v_remaining > 0 and v_tax > 0 then
      v_tax := least(v_tax, v_remaining);
      insert into public.expense_adjustments (
        expense_id, household_id, adjustment_type, description,
        amount_cents, allocation_mode, display_order
      ) values (
        v_expense_id, v_receipt.household_id, 'tax', 'Tax',
        v_tax, 'proportional', 1
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
        v_tip, 'proportional', 2
      );
      v_adjustments := v_adjustments + v_tip;
    end if;
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

create or replace function public.confirm_claimed_receipt_as_expense(
  p_receipt_id uuid,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.confirm_receipt_as_expense(p_receipt_id, p_idempotency_key);
end;
$$;

-- Grants
revoke all on function public.start_receipt_claiming(uuid, uuid[], text) from public;
revoke all on function public.claim_receipt_line(uuid, text) from public;
revoke all on function public.claim_receipt_line_quantity(uuid, numeric, text) from public;
revoke all on function public.unclaim_receipt_line(uuid) from public;
revoke all on function public.mark_receipt_line_shared(uuid, uuid[]) from public;
revoke all on function public.assign_receipt_line(uuid, uuid, boolean) from public;
revoke all on function public.finish_receipt_claiming(uuid) from public;
revoke all on function public.finalize_receipt_claims(uuid, boolean) from public;
revoke all on function public.set_receipt_split_workflow(uuid, text, uuid[], uuid) from public;
revoke all on function public.apply_remaining_receipt_lines(uuid, text) from public;
revoke all on function public.remind_receipt_claiming(uuid) from public;
revoke all on function public.confirm_claimed_receipt_as_expense(uuid, text) from public;

grant execute on function public.start_receipt_claiming(uuid, uuid[], text) to authenticated;
grant execute on function public.claim_receipt_line(uuid, text) to authenticated;
grant execute on function public.claim_receipt_line_quantity(uuid, numeric, text) to authenticated;
grant execute on function public.unclaim_receipt_line(uuid) to authenticated;
grant execute on function public.mark_receipt_line_shared(uuid, uuid[]) to authenticated;
grant execute on function public.assign_receipt_line(uuid, uuid, boolean) to authenticated;
grant execute on function public.finish_receipt_claiming(uuid) to authenticated;
grant execute on function public.finalize_receipt_claims(uuid, boolean) to authenticated;
grant execute on function public.set_receipt_split_workflow(uuid, text, uuid[], uuid) to authenticated;
grant execute on function public.apply_remaining_receipt_lines(uuid, text) to authenticated;
grant execute on function public.remind_receipt_claiming(uuid) to authenticated;
grant execute on function public.confirm_claimed_receipt_as_expense(uuid, text) to authenticated;
grant execute on function public.confirm_receipt_as_expense(uuid, text) to authenticated;
