-- Phase 8: propose / approve / activate / acknowledge / override

create or replace function public._governance_quorum_satisfied(
  p_mode text,
  p_quorum integer,
  p_percentage integer,
  p_required_count integer,
  p_approve_count integer,
  p_reject_count integer,
  p_abstain_count integer,
  p_changes_count integer,
  p_pending_count integer,
  p_total_voters integer
) returns jsonb language plpgsql immutable as $$
declare
  v_can_advance boolean := false;
  v_reason text := '';
  v_counted integer;
begin
  -- Abstentions never count as approval
  v_counted := p_approve_count + p_reject_count + p_changes_count;

  if p_reject_count > 0 and p_mode in ('unanimous','required_approvers','coordinator','financial_coordinator') then
    return jsonb_build_object(
      'satisfied', false,
      'can_advance', false,
      'reason', 'At least one rejection was recorded'
    );
  end if;
  if p_changes_count > 0 then
    return jsonb_build_object(
      'satisfied', false,
      'can_advance', false,
      'reason', 'Changes were requested'
    );
  end if;

  if p_mode = 'acknowledgment_only' then
    return jsonb_build_object('satisfied', true, 'can_advance', true, 'reason', 'Acknowledgment-only mode');
  end if;

  if p_mode = 'unanimous' then
    v_can_advance := p_approve_count >= greatest(p_quorum, p_total_voters)
      and p_pending_count = 0 and p_reject_count = 0 and p_abstain_count = 0;
    v_reason := case when v_can_advance then 'Unanimous approval met'
      else 'Unanimous approval requires every voter to approve (abstentions do not count)' end;
  elsif p_mode = 'simple_majority' then
    v_can_advance := p_approve_count > (p_total_voters / 2)
      and p_approve_count >= p_quorum
      and p_pending_count = 0;
    v_reason := case when v_can_advance then 'Simple majority met'
      else 'Simple majority and quorum not yet met; abstentions are not approvals' end;
  elsif p_mode = 'percentage' then
    v_can_advance := p_total_voters > 0
      and (p_approve_count * 100 / p_total_voters) >= coalesce(p_percentage, 100)
      and p_approve_count >= p_quorum
      and p_pending_count = 0;
    v_reason := case when v_can_advance then 'Percentage threshold met'
      else 'Percentage threshold or quorum not met' end;
  elsif p_mode in ('required_approvers','coordinator','financial_coordinator','mixed') then
    v_can_advance := p_approve_count >= greatest(p_quorum, p_required_count)
      and p_pending_count = 0 and p_reject_count = 0;
    v_reason := case when v_can_advance then 'Required approvals met'
      else 'Required approvers have not all approved' end;
  else
    v_reason := 'Unknown approval mode';
  end if;

  return jsonb_build_object(
    'satisfied', v_can_advance,
    'can_advance', v_can_advance,
    'reason', v_reason,
    'approve_count', p_approve_count,
    'reject_count', p_reject_count,
    'abstain_count', p_abstain_count,
    'changes_count', p_changes_count,
    'pending_count', p_pending_count,
    'quorum', p_quorum
  );
end $$;
revoke all on function public._governance_quorum_satisfied(text,integer,integer,integer,integer,integer,integer,integer,integer,integer) from public, anon;

create or replace function public.governance_approval_status(p_request_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_req public.governance_approval_requests%rowtype;
  v_approve int := 0; v_reject int := 0; v_abstain int := 0; v_changes int := 0;
  v_pending int := 0; v_total int := 0; v_required int := 0;
begin
  select * into v_req from public.governance_approval_requests where id = p_request_id;
  if not found then raise exception 'Approval request not found'; end if;
  if not public.can_view_governance_document(v_req.document_id) then
    raise exception 'Not allowed to view this approval request';
  end if;

  select
    count(*) filter (where decision = 'approve'),
    count(*) filter (where decision = 'reject'),
    count(*) filter (where decision = 'abstain'),
    count(*) filter (where decision = 'request_changes')
  into v_approve, v_reject, v_abstain, v_changes
  from public.governance_approval_responses
  where request_id = p_request_id;

  select count(*) into v_required
  from public.governance_participants
  where document_id = v_req.document_id
    and role in ('required_approver','coordinator','author','participant');

  if v_req.approval_mode in ('coordinator') then
    select count(*) into v_required
    from public.household_memberships m
    join public.household_membership_roles r on r.membership_id = m.id
    where m.household_id = v_req.household_id and m.status = 'active'
      and r.role = 'household_coordinator';
  elsif v_req.approval_mode = 'financial_coordinator' then
    select count(*) into v_required
    from public.household_memberships m
    join public.household_membership_roles r on r.membership_id = m.id
    where m.household_id = v_req.household_id and m.status = 'active'
      and r.role = 'financial_coordinator';
  end if;

  v_total := greatest(v_required, v_req.quorum);
  v_pending := greatest(v_total - (v_approve + v_reject + v_abstain + v_changes), 0);

  return public._governance_quorum_satisfied(
    v_req.approval_mode, v_req.quorum, v_req.percentage_threshold,
    v_required, v_approve, v_reject, v_abstain, v_changes, v_pending, v_total
  ) || jsonb_build_object(
    'request_id', p_request_id,
    'status', v_req.status,
    'coordinator_override', v_req.coordinator_override
  );
end $$;
grant execute on function public.governance_approval_status(uuid) to authenticated;

create or replace function public.propose_governance_version(
  p_document_id uuid,
  p_version_id uuid default null,
  p_participant_membership_ids uuid[] default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_doc public.governance_documents%rowtype;
  v_ver public.governance_document_versions%rowtype;
  v_actor uuid; v_req uuid; v_mode text; v_quorum int; v_pct int;
  v_mid uuid; v_targets uuid[];
begin
  perform set_config('householdos.governance_mutation', 'rpc', true);
  select * into v_doc from public.governance_documents where id = p_document_id for update;
  if not found then raise exception 'Governance document not found'; end if;
  v_actor := public._governance_active_membership(v_doc.household_id);
  if v_doc.created_by_membership_id <> v_actor
     and not public.is_household_coordinator(v_doc.household_id) then
    raise exception 'Only the author or a household coordinator may propose this document';
  end if;
  perform public._governance_assert_lifecycle(v_doc.status, 'proposed');

  select * into v_ver from public.governance_document_versions
  where id = coalesce(p_version_id, v_doc.current_version_id) for update;
  if not found or v_ver.document_id <> p_document_id then
    raise exception 'Version not found for document';
  end if;
  if v_ver.status not in ('draft','rejected','withdrawn') then
    raise exception 'Only draft versions may be proposed';
  end if;

  foreach v_mid in array coalesce(p_participant_membership_ids, '{}'::uuid[])
  loop
    insert into public.governance_participants(document_id, household_id, membership_id, role)
    values (p_document_id, v_doc.household_id, v_mid, 'required_approver')
    on conflict (document_id, membership_id) do update
      set role = case
        when governance_participants.role = 'author' then 'author'
        else 'required_approver'
      end;
  end loop;

  v_mode := coalesce(v_ver.approval_rules->>'mode', 'unanimous');
  v_quorum := greatest(coalesce((v_ver.approval_rules->>'quorum')::int, 1), 1);
  v_pct := nullif(v_ver.approval_rules->>'percentage_threshold','')::int;

  -- Freeze submitted version
  update public.governance_document_versions set
    status = 'proposed',
    frozen_at = now()
  where id = v_ver.id;

  update public.governance_documents set
    status = 'under_review',
    visibility = case
      when visibility = 'private_draft' then 'participants'
      else visibility
    end,
    current_version_id = v_ver.id
  where id = p_document_id;

  -- Supersede any open approval requests for older versions
  update public.governance_approval_requests set
    status = 'superseded', closed_at = now()
  where document_id = p_document_id and status = 'open';

  insert into public.governance_approval_requests(
    document_id, version_id, household_id, requested_by_membership_id,
    approval_mode, quorum, percentage_threshold, status
  ) values (
    p_document_id, v_ver.id, v_doc.household_id, v_actor,
    v_mode, v_quorum, v_pct, 'open'
  ) returning id into v_req;

  perform public._governance_append_event(
    p_document_id, v_doc.household_id, v_actor, 'proposed', v_ver.id, null,
    jsonb_build_object('request_id', v_req, 'content_hash', v_ver.content_hash)
  );
  perform public._governance_audit(
    v_doc.household_id, 'governance_document', p_document_id, 'governance.proposed',
    null, jsonb_build_object('version_id', v_ver.id, 'request_id', v_req)
  );

  select array_agg(p.membership_id) into v_targets
  from public.governance_participants p where p.document_id = p_document_id;
  perform public._governance_notify(
    v_doc.household_id, 'governance.approval_requested', p_document_id, v_actor,
    coalesce(v_targets, '{}'::uuid[]),
    'Approval requested',
    'A household document was proposed for review.',
    '/app/' || v_doc.household_id::text || '/governance/documents/' || p_document_id::text
  );
  return v_req;
end $$;

create or replace function public.withdraw_governance_proposal(
  p_document_id uuid,
  p_reason text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_doc public.governance_documents%rowtype;
  v_actor uuid;
begin
  perform set_config('householdos.governance_mutation', 'rpc', true);
  select * into v_doc from public.governance_documents where id = p_document_id for update;
  if not found then raise exception 'Governance document not found'; end if;
  v_actor := public._governance_active_membership(v_doc.household_id);
  if v_doc.created_by_membership_id <> v_actor
     and not public.is_household_coordinator(v_doc.household_id) then
    raise exception 'Only the proposer or a household coordinator may withdraw';
  end if;
  perform public._governance_assert_lifecycle(v_doc.status, 'withdrawn');

  update public.governance_approval_requests set
    status = 'withdrawn', closed_at = now(), outcome_reason = p_reason
  where document_id = p_document_id and status = 'open';

  update public.governance_document_versions set status = 'withdrawn'
  where id = v_doc.current_version_id;

  update public.governance_documents set status = 'withdrawn' where id = p_document_id;

  perform public._governance_append_event(
    p_document_id, v_doc.household_id, v_actor, 'withdrawn', v_doc.current_version_id, p_reason
  );
  return p_document_id;
end $$;

create or replace function public.respond_to_governance_approval(
  p_request_id uuid,
  p_decision text,
  p_comment text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_req public.governance_approval_requests%rowtype;
  v_ver public.governance_document_versions%rowtype;
  v_doc public.governance_documents%rowtype;
  v_actor uuid; v_id uuid; v_status jsonb; v_event text;
begin
  perform set_config('householdos.governance_mutation', 'rpc', true);
  select * into v_req from public.governance_approval_requests where id = p_request_id for update;
  if not found then raise exception 'Approval request not found'; end if;
  if v_req.status <> 'open' then raise exception 'Approval request is closed'; end if;
  v_actor := public._governance_active_membership(v_req.household_id);

  -- No approving on behalf of another member
  if p_decision not in ('approve','reject','abstain','request_changes') then
    raise exception 'Invalid approval decision';
  end if;

  select * into v_ver from public.governance_document_versions where id = v_req.version_id;
  select * into v_doc from public.governance_documents where id = v_req.document_id;

  if v_req.approval_mode = 'financial_coordinator' then
    if not public._is_financial_coordinator(v_req.household_id) and not v_doc.is_financial then
      raise exception 'Financial coordinator approval is only for financial documents';
    end if;
    if not public._is_financial_coordinator(v_req.household_id) then
      raise exception 'Only a financial coordinator may respond in this mode';
    end if;
  end if;
  if v_req.approval_mode = 'coordinator'
     and not public.is_household_coordinator(v_req.household_id) then
    raise exception 'Only a household coordinator may respond in this mode';
  end if;

  insert into public.governance_approval_responses(
    request_id, document_id, version_id, household_id,
    responder_membership_id, decision, comment, version_content_hash
  ) values (
    p_request_id, v_req.document_id, v_req.version_id, v_req.household_id,
    v_actor, p_decision, nullif(trim(coalesce(p_comment,'')),''), v_ver.content_hash
  )
  on conflict (request_id, responder_membership_id) do update set
    decision = excluded.decision,
    comment = excluded.comment,
    version_content_hash = excluded.version_content_hash,
    created_at = now()
  returning id into v_id;

  v_event := case p_decision
    when 'request_changes' then 'changes_requested'
    else 'approval_response'
  end;
  perform public._governance_append_event(
    v_req.document_id, v_req.household_id, v_actor, v_event, v_req.version_id,
    left(coalesce(p_comment,''), 200),
    jsonb_build_object('decision', p_decision, 'response_id', v_id)
  );

  v_status := public.governance_approval_status(p_request_id);

  if p_decision = 'reject' then
    update public.governance_approval_requests set
      status = 'rejected', closed_at = now(), outcome_reason = p_comment
    where id = p_request_id;
    update public.governance_documents set status = 'rejected' where id = v_req.document_id;
    update public.governance_document_versions set status = 'rejected' where id = v_req.version_id;
    perform public._governance_append_event(
      v_req.document_id, v_req.household_id, v_actor, 'rejected', v_req.version_id, p_comment
    );
    perform public._governance_notify(
      v_req.household_id, 'governance.proposal_rejected', v_req.document_id, v_actor,
      array[v_req.requested_by_membership_id],
      'Proposal rejected', 'A proposed household document was rejected.',
      '/app/' || v_req.household_id::text || '/governance/documents/' || v_req.document_id::text
    );
  elsif p_decision = 'request_changes' then
    update public.governance_approval_requests set
      status = 'changes_requested', closed_at = now(), outcome_reason = p_comment
    where id = p_request_id;
    perform public._governance_notify(
      v_req.household_id, 'governance.changes_requested', v_req.document_id, v_actor,
      array[v_req.requested_by_membership_id],
      'Changes requested', 'Changes were requested on a proposed household document.',
      '/app/' || v_req.household_id::text || '/governance/documents/' || v_req.document_id::text
    );
  elsif (v_status->>'can_advance')::boolean then
    update public.governance_approval_requests set
      status = 'approved', closed_at = now()
    where id = p_request_id;
    update public.governance_documents set status = 'approved' where id = v_req.document_id;
    update public.governance_document_versions set status = 'approved' where id = v_req.version_id;
    perform public._governance_append_event(
      v_req.document_id, v_req.household_id, v_actor, 'approved', v_req.version_id
    );
    perform public._governance_notify(
      v_req.household_id, 'governance.proposal_approved', v_req.document_id, v_actor,
      array[v_req.requested_by_membership_id],
      'Proposal approved', 'A household document was approved and may be activated.',
      '/app/' || v_req.household_id::text || '/governance/documents/' || v_req.document_id::text
    );
  end if;

  perform public._governance_audit(
    v_req.household_id, 'governance_approval_request', p_request_id,
    'governance.approval_response', null,
    jsonb_build_object('decision', p_decision, 'status', v_status)
  );
  return v_id;
end $$;

create or replace function public.override_governance_approval(
  p_request_id uuid,
  p_reason text,
  p_activate boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_req public.governance_approval_requests%rowtype;
  v_actor uuid;
begin
  perform set_config('householdos.governance_mutation', 'rpc', true);
  select * into v_req from public.governance_approval_requests where id = p_request_id for update;
  if not found then raise exception 'Approval request not found'; end if;
  v_actor := public._governance_active_membership(v_req.household_id);
  if not public.is_household_coordinator(v_req.household_id) then
    raise exception 'Only a household coordinator may use coordinator override';
  end if;
  if nullif(trim(coalesce(p_reason,'')),'') is null then
    raise exception 'Coordinator override requires a reason';
  end if;

  -- Never fabricate individual approvals; record override separately
  update public.governance_approval_requests set
    status = 'approved',
    coordinator_override = true,
    override_reason = trim(p_reason),
    override_by_membership_id = v_actor,
    closed_at = now()
  where id = p_request_id;

  update public.governance_documents set status = 'approved' where id = v_req.document_id;
  update public.governance_document_versions set status = 'approved' where id = v_req.version_id;

  perform public._governance_append_event(
    v_req.document_id, v_req.household_id, v_actor, 'override', v_req.version_id,
    trim(p_reason),
    jsonb_build_object('request_id', p_request_id, 'fabricated_approvals', false)
  );
  perform public._governance_audit(
    v_req.household_id, 'governance_approval_request', p_request_id,
    'governance.coordinator_override', null,
    jsonb_build_object('reason', trim(p_reason))
  );

  if coalesce(p_activate, false) then
    perform public.activate_governance_version(v_req.document_id, v_req.version_id, null);
  end if;
  return p_request_id;
end $$;

create or replace function public.activate_governance_version(
  p_document_id uuid,
  p_version_id uuid default null,
  p_effective_at timestamptz default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_doc public.governance_documents%rowtype;
  v_ver public.governance_document_versions%rowtype;
  v_prior uuid; v_actor uuid; v_eff timestamptz;
  v_ack jsonb; v_mid uuid; v_members uuid[];
begin
  perform set_config('householdos.governance_mutation', 'rpc', true);
  select * into v_doc from public.governance_documents where id = p_document_id for update;
  if not found then raise exception 'Governance document not found'; end if;
  v_actor := public._governance_active_membership(v_doc.household_id);
  if not public.is_household_coordinator(v_doc.household_id) then
    raise exception 'Only a household coordinator may activate a document';
  end if;

  select * into v_ver from public.governance_document_versions
  where id = coalesce(p_version_id, v_doc.current_version_id) for update;
  if not found or v_ver.document_id <> p_document_id then
    raise exception 'Version not found';
  end if;
  if v_ver.status not in ('approved','active') then
    raise exception 'Only approved versions may be activated';
  end if;
  perform public._governance_assert_lifecycle(
    case when v_doc.status = 'active' then 'approved' else v_doc.status end,
    'active'
  );

  v_eff := coalesce(p_effective_at, v_ver.effective_at, now());
  v_prior := v_doc.active_version_id;

  if v_prior is not null and v_prior <> v_ver.id then
    update public.governance_document_versions set
      status = 'superseded',
      superseded_by_version_id = v_ver.id,
      effective_until = v_eff
    where id = v_prior;
    perform public._governance_append_event(
      p_document_id, v_doc.household_id, v_actor, 'superseded', v_prior, null,
      jsonb_build_object('superseded_by', v_ver.id)
    );
  end if;

  update public.governance_document_versions set
    status = 'active',
    activated_at = now(),
    effective_at = v_eff,
    frozen_at = coalesce(frozen_at, now())
  where id = v_ver.id;

  update public.governance_documents set
    status = 'active',
    active_version_id = v_ver.id,
    current_version_id = v_ver.id,
    visibility = 'household',
    title = v_ver.title,
    summary = v_ver.summary
  where id = p_document_id;

  -- Acknowledgments
  v_ack := coalesce(v_ver.acknowledgment_rules, '{"required":false}'::jsonb);
  if coalesce((v_ack->>'required')::boolean, false) then
    if coalesce(v_ack->>'scope','all_active') = 'all_active' then
      select array_agg(m.id) into v_members
      from public.household_memberships m
      where m.household_id = v_doc.household_id and m.status = 'active';
    else
      select array_agg(p.membership_id) into v_members
      from public.governance_participants p where p.document_id = p_document_id;
    end if;
    foreach v_mid in array coalesce(v_members, '{}'::uuid[])
    loop
      insert into public.governance_acknowledgments(
        document_id, version_id, household_id, membership_id, status, due_at,
        reminder_cadence_hours, version_content_hash
      ) values (
        p_document_id, v_ver.id, v_doc.household_id, v_mid, 'pending',
        case when v_ack ? 'deadline_hours'
          then now() + make_interval(hours => greatest((v_ack->>'deadline_hours')::int, 1))
          else null end,
        nullif(v_ack->>'reminder_cadence_hours','')::int,
        v_ver.content_hash
      )
      on conflict (version_id, membership_id) do nothing;
    end loop;
  end if;

  perform public._governance_append_event(
    p_document_id, v_doc.household_id, v_actor, 'activated', v_ver.id, null,
    jsonb_build_object('effective_at', v_eff, 'prior_version_id', v_prior)
  );
  perform public._governance_audit(
    v_doc.household_id, 'governance_document', p_document_id, 'governance.activated',
    null, jsonb_build_object('version_id', v_ver.id, 'effective_at', v_eff)
  );

  select array_agg(m.id) into v_members
  from public.household_memberships m
  where m.household_id = v_doc.household_id and m.status = 'active';
  perform public._governance_notify(
    v_doc.household_id, 'governance.document_activated', p_document_id, v_actor,
    coalesce(v_members, '{}'::uuid[]),
    'Document activated',
    'A household policy or agreement is now active.',
    '/app/' || v_doc.household_id::text || '/governance/documents/' || p_document_id::text
  );
  if v_prior is not null and v_prior <> v_ver.id then
    perform public._governance_notify(
      v_doc.household_id, 'governance.document_superseded', p_document_id, v_actor,
      coalesce(v_members, '{}'::uuid[]),
      'Document updated',
      'An active household document was replaced by a newer version.',
      '/app/' || v_doc.household_id::text || '/governance/documents/' || p_document_id::text
    );
  end if;
  if coalesce((v_ack->>'required')::boolean, false) then
    perform public._governance_notify(
      v_doc.household_id, 'governance.acknowledgment_requested', p_document_id, v_actor,
      coalesce(v_members, '{}'::uuid[]),
      'Acknowledgment requested',
      'Please confirm you have reviewed an active household document.',
      '/app/' || v_doc.household_id::text || '/governance/acknowledgments'
    );
  end if;
  return v_ver.id;
end $$;

create or replace function public.acknowledge_governance_version(
  p_version_id uuid,
  p_comment text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_ver public.governance_document_versions%rowtype;
  v_actor uuid; v_id uuid;
begin
  perform set_config('householdos.governance_mutation', 'rpc', true);
  select * into v_ver from public.governance_document_versions where id = p_version_id;
  if not found then raise exception 'Version not found'; end if;
  if v_ver.status <> 'active' then
    raise exception 'Only active versions may be acknowledged';
  end if;
  v_actor := public._governance_active_membership(v_ver.household_id);

  update public.governance_acknowledgments set
    status = 'acknowledged',
    acknowledged_at = now(),
    comment = nullif(trim(coalesce(p_comment,'')),''),
    version_content_hash = v_ver.content_hash
  where version_id = p_version_id
    and membership_id = v_actor
  returning id into v_id;

  if v_id is null then
    insert into public.governance_acknowledgments(
      document_id, version_id, household_id, membership_id, status,
      acknowledged_at, comment, version_content_hash
    ) values (
      v_ver.document_id, p_version_id, v_ver.household_id, v_actor, 'acknowledged',
      now(), nullif(trim(coalesce(p_comment,'')),''), v_ver.content_hash
    ) returning id into v_id;
  end if;

  perform public._governance_append_event(
    v_ver.document_id, v_ver.household_id, v_actor, 'acknowledged', p_version_id,
    left(coalesce(p_comment,''), 200)
  );
  perform public._governance_audit(
    v_ver.household_id, 'governance_document', v_ver.document_id,
    'governance.acknowledged', null,
    jsonb_build_object('version_id', p_version_id, 'acknowledgment_id', v_id)
  );
  return v_id;
end $$;

create or replace function public.create_revised_governance_version(
  p_document_id uuid,
  p_title text default null,
  p_summary text default null,
  p_sections jsonb default null,
  p_change_summary text default null,
  p_approval_rules jsonb default null,
  p_acknowledgment_rules jsonb default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_doc public.governance_documents%rowtype;
  v_ver public.governance_document_versions%rowtype;
  v_actor uuid; v_new uuid; v_plain text; v_hash text; v_sections jsonb;
begin
  perform set_config('householdos.governance_mutation', 'rpc', true);
  select * into v_doc from public.governance_documents where id = p_document_id for update;
  if not found then raise exception 'Governance document not found'; end if;
  v_actor := public._governance_active_membership(v_doc.household_id);
  if v_doc.created_by_membership_id <> v_actor
     and not public.is_household_coordinator(v_doc.household_id) then
    raise exception 'Not allowed to revise this document';
  end if;

  select * into v_ver from public.governance_document_versions
  where id = v_doc.current_version_id;

  if p_sections is not null then
    v_sections := p_sections;
  else
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'section_type', section_type, 'heading', heading, 'body', body, 'payload', payload
      ) order by position
    ), '[]'::jsonb)
    into v_sections from public.governance_sections where version_id = v_ver.id;
  end if;

  v_plain := public._governance_sections_to_plain(v_sections);
  v_hash := public._governance_hash_content(
    coalesce(nullif(trim(coalesce(p_title,'')),''), v_ver.title),
    case when p_summary is null then v_ver.summary else nullif(trim(p_summary),'') end,
    v_plain, v_sections
  );

  insert into public.governance_document_versions(
    document_id, household_id, version_number, title, summary, plain_text,
    content_hash, author_membership_id, change_summary, approval_rules,
    acknowledgment_rules, status, prior_version_id
  ) values (
    p_document_id, v_doc.household_id, v_ver.version_number + 1,
    coalesce(nullif(trim(coalesce(p_title,'')),''), v_ver.title),
    case when p_summary is null then v_ver.summary else nullif(trim(p_summary),'') end,
    v_plain, v_hash, v_actor,
    coalesce(nullif(trim(coalesce(p_change_summary,'')),''), 'Revised after review'),
    coalesce(p_approval_rules, v_ver.approval_rules),
    coalesce(p_acknowledgment_rules, v_ver.acknowledgment_rules),
    'draft', v_ver.id
  ) returning id into v_new;

  perform public._governance_insert_sections(v_new, p_document_id, v_doc.household_id, v_sections);

  update public.governance_documents set
    status = 'draft',
    current_version_id = v_new,
    title = coalesce(nullif(trim(coalesce(p_title,'')),''), title),
    summary = case when p_summary is null then summary else nullif(trim(p_summary),'') end
  where id = p_document_id;

  -- Prior approvals remain historically but are invalid for activation of the new version
  update public.governance_approval_requests set
    status = 'superseded', closed_at = coalesce(closed_at, now())
  where document_id = p_document_id and status = 'open';

  perform public._governance_append_event(
    p_document_id, v_doc.household_id, v_actor, 'version_revised', v_new, p_change_summary,
    jsonb_build_object('prior_approvals_invalidated_for_activation', true)
  );
  return v_new;
end $$;

grant execute on function public.propose_governance_version(uuid,uuid,uuid[]) to authenticated;
grant execute on function public.withdraw_governance_proposal(uuid,text) to authenticated;
grant execute on function public.respond_to_governance_approval(uuid,text,text) to authenticated;
grant execute on function public.override_governance_approval(uuid,text,boolean) to authenticated;
grant execute on function public.activate_governance_version(uuid,uuid,timestamptz) to authenticated;
grant execute on function public.acknowledge_governance_version(uuid,text) to authenticated;
grant execute on function public.create_revised_governance_version(uuid,text,text,jsonb,text,jsonb,jsonb) to authenticated;
