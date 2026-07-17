import type { ApprovalMode, QuorumStatus } from "./types";

export type QuorumInput = {
  mode: ApprovalMode;
  quorum: number;
  percentageThreshold?: number | null;
  requiredCount: number;
  approveCount: number;
  rejectCount: number;
  abstainCount: number;
  changesCount: number;
  pendingCount: number;
  totalVoters: number;
};

/**
 * Quorum / threshold evaluation.
 * Abstentions never count as approval.
 */
export function evaluateQuorum(input: QuorumInput): QuorumStatus {
  const {
    mode,
    quorum,
    percentageThreshold,
    requiredCount,
    approveCount,
    rejectCount,
    abstainCount,
    changesCount,
    pendingCount,
    totalVoters,
  } = input;

  if (
    rejectCount > 0 &&
    (mode === "unanimous" ||
      mode === "required_approvers" ||
      mode === "coordinator" ||
      mode === "financial_coordinator")
  ) {
    return base(false, "At least one rejection was recorded", input);
  }
  if (changesCount > 0) {
    return base(false, "Changes were requested", input);
  }
  if (mode === "acknowledgment_only") {
    return base(true, "Acknowledgment-only mode", input);
  }

  let canAdvance = false;
  let reason = "";

  if (mode === "unanimous") {
    canAdvance =
      approveCount >= Math.max(quorum, totalVoters) &&
      pendingCount === 0 &&
      rejectCount === 0 &&
      abstainCount === 0;
    reason = canAdvance
      ? "Unanimous approval met"
      : "Unanimous approval requires every voter to approve (abstentions do not count)";
  } else if (mode === "simple_majority") {
    canAdvance =
      approveCount > totalVoters / 2 &&
      approveCount >= quorum &&
      pendingCount === 0;
    reason = canAdvance
      ? "Simple majority met"
      : "Simple majority and quorum not yet met; abstentions are not approvals";
  } else if (mode === "percentage") {
    const pct = percentageThreshold ?? 100;
    canAdvance =
      totalVoters > 0 &&
      (approveCount * 100) / totalVoters >= pct &&
      approveCount >= quorum &&
      pendingCount === 0;
    reason = canAdvance
      ? "Percentage threshold met"
      : "Percentage threshold or quorum not met";
  } else {
    canAdvance =
      approveCount >= Math.max(quorum, requiredCount) &&
      pendingCount === 0 &&
      rejectCount === 0;
    reason = canAdvance
      ? "Required approvals met"
      : "Required approvers have not all approved";
  }

  return base(canAdvance, reason, input);
}

function base(
  canAdvance: boolean,
  reason: string,
  input: QuorumInput,
): QuorumStatus {
  return {
    satisfied: canAdvance,
    can_advance: canAdvance,
    reason,
    approve_count: input.approveCount,
    reject_count: input.rejectCount,
    abstain_count: input.abstainCount,
    changes_count: input.changesCount,
    pending_count: input.pendingCount,
    quorum: input.quorum,
  };
}

/** Prior approvals on older versions cannot activate a newer version. */
export function approvalsValidForActivation(params: {
  responseVersionHash: string;
  currentVersionHash: string;
  requestVersionId: string;
  currentVersionId: string;
}): boolean {
  return (
    params.responseVersionHash === params.currentVersionHash &&
    params.requestVersionId === params.currentVersionId
  );
}
