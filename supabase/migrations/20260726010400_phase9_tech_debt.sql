-- Phase 9 tech debt: governance quorum lint + recipe scoring authority note

-- ---------------------------------------------------------------------------
-- Fix _governance_quorum_satisfied: remove unused v_counted; STABLE volatility
-- Logic mirrors src/lib/governance/quorum.ts and prior migration body.
-- ---------------------------------------------------------------------------
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
) returns jsonb
language plpgsql
stable
as $$
declare
  v_can_advance boolean := false;
  v_reason text := '';
begin
  -- Abstentions never count as approval.
  -- (approve + reject + changes is available as counted ballots when needed.)

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
end;
$$;

revoke all on function public._governance_quorum_satisfied(
  text, integer, integer, integer, integer, integer, integer, integer, integer, integer
) from public, anon;

-- Soft-score formula remains authoritative in TypeScript
comment on function public.recommendation_weight_table() is
  'Weight matrix aligned with TypeScript. Soft component formula values are authoritative in src/lib/meals/scoring/score.ts; SQL applies hard excludes and weight multipliers.';
