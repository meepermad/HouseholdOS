-- In-app alerts when someone owes a roommate, and chore reminders that say
-- which chore. Scheduled and overdue chore sends stay in the notification worker.

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
        or p_event_type like 'reimbursement.%'
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
        'reimbursement.created',
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
        'settlement.route_reversed',
        'chore.due_soon',
        'chore.overdue'
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
        'reimbursement.created',
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
        'opening_balance.confirmation_required',
        'chore.assigned',
        'chore.due_soon',
        'chore.overdue',
        'chore.reminder'
      ) then true
      else false
    end;
$$;

revoke all on function public._notification_meta_for_event_type(text) from public;

-- ---------------------------------------------------------------------------
-- Tell the debtor (and the other party, when they did not just record it)
-- that money is owed. A notification failure must not roll back the obligation.
-- ---------------------------------------------------------------------------
create or replace function public.notify_new_reimbursement_obligation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_debtor_user uuid;
  v_creditor_user uuid;
  v_creditor_name text;
  v_debtor_name text;
  v_source text;
  v_amount text;
  v_href text;
  v_actor uuid;
begin
  if new.obligation_kind not in ('reimbursement', 'opening_balance') then
    return new;
  end if;
  if coalesce(new.current_amount_cents, 0) <= 0 then
    return new;
  end if;
  if new.status in ('reversed', 'waived', 'settled') then
    return new;
  end if;

  begin
    v_debtor_user := public._membership_user_id(new.debtor_membership_id);
    v_creditor_user := public._membership_user_id(new.creditor_membership_id);
    v_actor := public.current_membership_id(new.household_id);

    select left(coalesce(nullif(trim(pr.display_name), ''), 'your roommate'), 80)
      into v_creditor_name
    from public.household_memberships m
    join public.profiles pr on pr.id = m.user_id
    where m.id = new.creditor_membership_id;

    select left(coalesce(nullif(trim(pr.display_name), ''), 'A roommate'), 80)
      into v_debtor_name
    from public.household_memberships m
    join public.profiles pr on pr.id = m.user_id
    where m.id = new.debtor_membership_id;

    v_creditor_name := coalesce(v_creditor_name, 'your roommate');
    v_debtor_name := coalesce(v_debtor_name, 'A roommate');

    if new.obligation_kind = 'opening_balance' then
      v_source := 'an opening balance';
    elsif new.expense_id is not null then
      select left(coalesce(nullif(trim(e.merchant), ''), 'a shared expense'), 80)
        into v_source
      from public.expenses e
      where e.id = new.expense_id;
      v_source := coalesce(v_source, 'a shared expense');
    else
      v_source := 'a shared expense';
    end if;

    v_amount := to_char(new.current_amount_cents / 100.0, 'FM999999990.00');
    v_href := '/app/' || new.household_id::text || '/money/reimbursements/' || new.id::text;

    if v_debtor_user is not null and v_debtor_user is distinct from auth.uid() then
      perform public._emit_notification_event(
        new.household_id,
        'reimbursement.created',
        'reimbursement_obligation',
        new.id,
        v_actor,
        jsonb_build_object('source_type', 'reimbursement_obligation', 'source_id', new.id),
        'reimbursement.created:' || new.id::text || ':debtor',
        array[v_debtor_user],
        'You owe ' || v_creditor_name,
        'You owe ' || v_creditor_name || ' $' || v_amount || ' for ' || v_source || '.',
        v_href
      );
    end if;

    if v_creditor_user is not null
       and v_creditor_user is distinct from auth.uid()
       and v_creditor_user is distinct from v_debtor_user then
      perform public._emit_notification_event(
        new.household_id,
        'reimbursement.created',
        'reimbursement_obligation',
        new.id,
        v_actor,
        jsonb_build_object('source_type', 'reimbursement_obligation', 'source_id', new.id),
        'reimbursement.created:' || new.id::text || ':creditor',
        array[v_creditor_user],
        v_debtor_name || ' owes you',
        v_debtor_name || ' owes you $' || v_amount || ' for ' || v_source || '.',
        v_href
      );
    end if;
  exception
    when others then
      raise warning 'obligation notification skipped: %', sqlerrm;
  end;

  return new;
end;
$$;

revoke all on function public.notify_new_reimbursement_obligation() from public;

drop trigger if exists reimbursement_obligations_notify_created
  on public.reimbursement_obligations;
create trigger reimbursement_obligations_notify_created
  after insert on public.reimbursement_obligations
  for each row execute function public.notify_new_reimbursement_obligation();

-- ---------------------------------------------------------------------------
-- Chore assignment copy names the chore. Reminders do too.
-- ---------------------------------------------------------------------------
create or replace function public._chore_notify(
  p_household_id uuid,
  p_event_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_actor uuid,
  p_memberships uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_users uuid[];
  v_title text;
  v_body text;
  v_chore text;
begin
  select left(coalesce(nullif(trim(d.title), ''), 'A chore'), 80)
    into v_chore
  from public.chore_occurrences o
  join public.chore_definitions d on d.id = o.definition_id
  where o.id = p_entity_id;
  v_chore := coalesce(v_chore, 'A chore');

  if p_event_type = 'chore.assigned' then
    v_title := 'A chore is yours';
    v_body := v_chore || ' was assigned to you.';
  elsif p_event_type = 'chore.completed' then
    v_title := 'Chore finished';
    v_body := v_chore || ' was marked done.';
  elsif p_event_type = 'chore.reassigned' then
    v_title := 'Chore reassigned';
    v_body := v_chore || ' has a new assignee.';
  elsif p_event_type = 'chore.awaiting_verification' then
    v_title := 'Chore needs a look';
    v_body := v_chore || ' was marked done and is waiting for review.';
  else
    v_title := 'Chore update';
    v_body := v_chore || ' was updated.';
  end if;

  select array_agg(distinct m.user_id) into v_users
  from public.household_memberships m
  where m.id = any(coalesce(p_memberships, '{}'::uuid[]))
    and m.status = 'active'
    and m.user_id is distinct from auth.uid();

  if cardinality(coalesce(v_users, '{}'::uuid[])) > 0 then
    perform public._emit_notification_event(
      p_household_id,
      p_event_type,
      p_entity_type,
      p_entity_id,
      p_actor,
      jsonb_build_object('source_type', p_entity_type, 'source_id', p_entity_id),
      p_event_type || ':' || p_entity_id::text,
      v_users,
      v_title,
      v_body,
      '/app/' || p_household_id::text || '/chores/' || p_entity_id::text
    );
  end if;
end;
$$;

revoke all on function public._chore_notify(uuid, text, text, uuid, uuid, uuid[]) from public, anon;

create or replace function public._reconcile_chore_reminders(p_occurrence_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_occ public.chore_occurrences%rowtype;
  v_def public.chore_definitions%rowtype;
  v_offset int;
  v_user uuid;
  v_fire timestamptz;
  v_count int := 0;
  v_chore text;
begin
  select * into v_occ from public.chore_occurrences where id = p_occurrence_id;
  if not found then return 0; end if;
  select * into v_def from public.chore_definitions where id = v_occ.definition_id;
  v_chore := left(coalesce(nullif(trim(v_def.title), ''), 'A chore'), 80);

  update public.scheduled_notification_requests
  set cancelled_at = now(), updated_at = now()
  where source_type = 'chore_occurrence'
    and source_id = p_occurrence_id
    and processed_at is null
    and cancelled_at is null;

  if v_occ.status not in ('scheduled', 'in_progress', 'reopened') or v_def.status <> 'active' then
    return 0;
  end if;

  foreach v_offset in array v_def.reminder_offsets loop
    v_fire := v_occ.due_at - make_interval(mins => v_offset);
    if v_fire < now() - interval '1 minute' then
      continue;
    end if;
    for v_user in
      select distinct m.user_id
      from public.chore_assignments a
      join public.household_memberships m on m.id = a.membership_id
      where a.occurrence_id = p_occurrence_id
        and a.status <> 'released'
        and m.user_id is not null
    loop
      perform public._create_scheduled_notification_request(
        'chore_occurrence',
        p_occurrence_id,
        v_user,
        'chore.reminder',
        v_fire,
        v_def.time_zone,
        'chore_occurrence:' || p_occurrence_id::text || ':' || v_user::text || ':' || v_offset::text,
        jsonb_build_object(
          'household_id', v_occ.household_id,
          'source_type', 'chore_occurrence',
          'source_id', p_occurrence_id,
          'title', 'Chore coming due',
          'body', v_chore || ' is due soon.',
          'action_href', '/app/' || v_occ.household_id::text || '/chores/' || p_occurrence_id::text
        )
      );
      v_count := v_count + 1;
    end loop;
  end loop;
  return v_count;
end;
$$;

revoke all on function public._reconcile_chore_reminders(uuid) from public, anon;

-- Rescheduling a reminder must clear a previous cancellation. A row that
-- already sent stays sent.
create or replace function public._create_scheduled_notification_request(
  p_source_type text,
  p_source_id uuid,
  p_recipient_user_id uuid,
  p_event_type text,
  p_scheduled_at timestamptz,
  p_time_zone text,
  p_idempotency_key text,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.scheduled_notification_requests (
    source_type,
    source_id,
    recipient_user_id,
    event_type,
    scheduled_at,
    time_zone,
    idempotency_key,
    payload
  ) values (
    p_source_type,
    p_source_id,
    p_recipient_user_id,
    p_event_type,
    p_scheduled_at,
    coalesce(nullif(trim(p_time_zone), ''), 'America/Chicago'),
    p_idempotency_key,
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (idempotency_key) do update
    set scheduled_at = excluded.scheduled_at,
        payload = excluded.payload,
        event_type = excluded.event_type,
        time_zone = excluded.time_zone,
        cancelled_at = null,
        updated_at = now()
    where scheduled_notification_requests.processed_at is null
  returning id into v_id;

  if v_id is null then
    select id into v_id
    from public.scheduled_notification_requests
    where idempotency_key = p_idempotency_key;
  end if;

  return v_id;
end;
$$;

revoke all on function public._create_scheduled_notification_request(text, uuid, uuid, text, timestamptz, text, text, jsonb) from public;

-- Deliver due reminders. Skip anything more than three days late so the first
-- worker run does not empty a stale backlog into the inbox.
create or replace function public.process_due_scheduled_notifications(
  p_limit int default 50
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_req public.scheduled_notification_requests%rowtype;
  v_event_id uuid;
  v_count integer := 0;
  v_title text;
  v_body text;
  v_household uuid;
begin
  if coalesce(auth.jwt() ->> 'role', '') is distinct from 'service_role' then
    raise exception 'process_due_scheduled_notifications requires service_role';
  end if;

  for v_req in
    select *
    from public.scheduled_notification_requests
    where processed_at is null
      and cancelled_at is null
      and scheduled_at <= now()
    order by scheduled_at asc, created_at asc
    for update skip locked
    limit v_limit
  loop
    if v_req.scheduled_at < now() - interval '3 days' then
      update public.scheduled_notification_requests
      set processed_at = now(),
          updated_at = now()
      where id = v_req.id
        and processed_at is null;
      continue;
    end if;

    v_title := coalesce(nullif(v_req.payload ->> 'title', ''), 'Scheduled reminder');
    v_body := coalesce(nullif(v_req.payload ->> 'body', ''), '');
    v_household := null;
    if coalesce(v_req.payload ->> 'household_id', '') ~
       '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then
      v_household := (v_req.payload ->> 'household_id')::uuid;
    end if;

    v_event_id := public._emit_notification_event(
      v_household,
      v_req.event_type,
      v_req.source_type,
      v_req.source_id,
      null,
      jsonb_build_object(
        'source_type', v_req.source_type,
        'source_id', v_req.source_id
      ),
      'scheduled:' || v_req.idempotency_key,
      array[v_req.recipient_user_id],
      v_title,
      v_body,
      nullif(v_req.payload ->> 'action_href', '')
    );

    update public.scheduled_notification_requests
    set processed_at = now(),
        notification_event_id = v_event_id,
        updated_at = now()
    where id = v_req.id
      and processed_at is null;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.process_due_scheduled_notifications(int) from public;
revoke all on function public.process_due_scheduled_notifications(int) from authenticated;
grant execute on function public.process_due_scheduled_notifications(int) to service_role;

-- One overdue notice per assignee per occurrence per day.
create or replace function public.notify_overdue_chores(p_limit int default 40)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 40), 1), 100);
  v_count int := 0;
  v_row record;
  v_href text;
begin
  if coalesce(auth.jwt() ->> 'role', '') is distinct from 'service_role' then
    raise exception 'notify_overdue_chores requires service_role';
  end if;

  for v_row in
    select
      o.id as occurrence_id,
      o.household_id,
      m.user_id,
      left(coalesce(nullif(trim(d.title), ''), 'A chore'), 80) as chore_title
    from public.chore_occurrences o
    join public.chore_definitions d on d.id = o.definition_id
    join public.chore_assignments a
      on a.occurrence_id = o.id
     and a.status <> 'released'
    join public.household_memberships m
      on m.id = a.membership_id
     and m.status = 'active'
    where o.status in ('scheduled', 'in_progress', 'reopened', 'blocked')
      and o.due_at < now()
      and o.due_at > now() - interval '14 days'
      and m.user_id is not null
    order by o.due_at asc
    limit v_limit
  loop
    v_href := '/app/' || v_row.household_id::text || '/chores/' || v_row.occurrence_id::text;
    perform public._emit_notification_event(
      v_row.household_id,
      'chore.overdue',
      'chore_occurrence',
      v_row.occurrence_id,
      null,
      jsonb_build_object('source_type', 'chore_occurrence', 'source_id', v_row.occurrence_id),
      'chore.overdue:' || v_row.occurrence_id::text || ':' || v_row.user_id::text || ':' || to_char(now() at time zone 'UTC', 'YYYY-MM-DD'),
      array[v_row.user_id],
      'Chore is overdue',
      v_row.chore_title || ' was due and is still open.',
      v_href
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.notify_overdue_chores(int) from public;
revoke all on function public.notify_overdue_chores(int) from authenticated;
grant execute on function public.notify_overdue_chores(int) to service_role;
