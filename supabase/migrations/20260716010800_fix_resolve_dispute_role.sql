-- Fix resolve_dispute: membership roles column is `role`, not `responsibility`

create or replace function public.resolve_dispute(
  p_dispute_id uuid,
  p_resolution_type text,
  p_resolution_note text,
  p_related_corrective_entity_type text default null,
  p_related_corrective_entity_id uuid default null
)
returns public.reimbursement_disputes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dispute public.reimbursement_disputes%rowtype;
  v_membership uuid;
  v_raiser_user uuid;
  v_is_coord boolean;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_resolution_type is null then
    raise exception 'Resolution type required';
  end if;

  perform set_config('householdos.payment_mutation', 'rpc', true);

  select * into v_dispute from public.reimbursement_disputes where id = p_dispute_id for update;
  if not found then
    raise exception 'Dispute not found';
  end if;
  if v_dispute.status in ('resolved', 'withdrawn') then
    raise exception 'Dispute conflict';
  end if;

  v_membership := public.current_membership_id(v_dispute.household_id);
  select exists (
    select 1 from public.household_membership_roles r
    where r.membership_id = v_membership
      and r.role = 'financial_coordinator'
  ) into v_is_coord;

  if v_membership is distinct from v_dispute.raised_by_membership_id and not v_is_coord then
    if v_dispute.payment_id is not null then
      if not exists (
        select 1 from public.payments p
        where p.id = v_dispute.payment_id
          and (p.sender_membership_id = v_membership or p.recipient_membership_id = v_membership)
      ) then
        raise exception 'Dispute conflict';
      end if;
    elsif v_dispute.obligation_id is not null then
      if not exists (
        select 1 from public.reimbursement_obligations o
        where o.id = v_dispute.obligation_id
          and (o.debtor_membership_id = v_membership or o.creditor_membership_id = v_membership)
      ) then
        raise exception 'Dispute conflict';
      end if;
    elsif not v_is_coord then
      raise exception 'Dispute conflict';
    end if;
  end if;

  update public.reimbursement_disputes
  set status = 'resolved',
      resolution_type = p_resolution_type,
      resolution_note = nullif(trim(coalesce(p_resolution_note, '')), ''),
      resolved_at = now(),
      resolved_by_membership_id = v_membership,
      related_corrective_entity_type = p_related_corrective_entity_type,
      related_corrective_entity_id = p_related_corrective_entity_id,
      updated_at = now()
  where id = p_dispute_id
  returning * into v_dispute;

  insert into public.dispute_events (
    dispute_id, household_id, actor_membership_id, event_type, note
  ) values (
    p_dispute_id, v_dispute.household_id, v_membership, 'resolved',
    coalesce(p_resolution_note, p_resolution_type)
  );

  perform public._payment_audit(
    v_dispute.household_id, 'reimbursement_dispute', p_dispute_id, 'dispute.resolved',
    jsonb_build_object('status', 'open'),
    jsonb_build_object('status', 'resolved', 'resolution_type', p_resolution_type),
    p_resolution_note, null
  );

  v_raiser_user := public._membership_user_id(v_dispute.raised_by_membership_id);
  perform public._emit_notification_event(
    v_dispute.household_id,
    'dispute.resolved',
    'reimbursement_dispute',
    p_dispute_id,
    v_membership,
    jsonb_build_object('dispute_id', p_dispute_id, 'resolution_type', p_resolution_type),
    'dispute.resolved:' || p_dispute_id::text,
    array[v_raiser_user],
    'Dispute resolved',
    'A financial dispute was resolved.',
    '/app/' || v_dispute.household_id::text || '/money/disputes/' || p_dispute_id::text
  );

  return v_dispute;
end;
$$;

revoke all on function public.resolve_dispute(uuid, text, text, text, uuid) from public;
grant execute on function public.resolve_dispute(uuid, text, text, text, uuid) to authenticated;
