export type SubmissionObligation = {
  id: string;
  label: string;
  householdId: string;
  debtorMembershipId: string;
  creditorMembershipId: string;
  officialOutstandingCents: number;
  pendingPaymentCents: number;
  storedStatus: string;
};

export type SubmissionAllocation = {
  obligationId: string;
  amountCents: number;
};

export type SubmissionReview =
  | { ok: true; ids: string[] }
  | { ok: false; message: string; ids: string[] };

/**
 * Server-side check of the ids the client claims to have selected.
 * Checkbox state is never trusted on its own.
 */
export function reviewSettlementSubmission(params: {
  direction: "sent" | "received";
  actorMembershipId: string;
  counterpartyMembershipId: string;
  householdId: string;
  totalAmountCents: number;
  allocations: readonly SubmissionAllocation[];
  obligations: readonly SubmissionObligation[];
}): SubmissionReview {
  const ids = params.allocations.map((row) => row.obligationId);
  if (params.allocations.length === 0) {
    return {
      ok: false,
      ids,
      message: "Select at least one expense to settle.",
    };
  }

  const seen = new Set<string>();
  const problems: string[] = [];
  let sum = 0;
  const byId = new Map(params.obligations.map((row) => [row.id, row]));

  for (const row of params.allocations) {
    if (seen.has(row.obligationId)) {
      problems.push("The same expense was included more than once.");
      continue;
    }
    seen.add(row.obligationId);
    if (!Number.isInteger(row.amountCents) || row.amountCents <= 0) {
      problems.push("Each selected expense needs a positive amount in cents.");
      continue;
    }
    const obligation = byId.get(row.obligationId);
    if (!obligation || obligation.householdId !== params.householdId) {
      problems.push(
        "An expense you selected is not an open balance in this household.",
      );
      continue;
    }
    const label = obligation.label || "An expense";
    if (obligation.storedStatus === "reversed") {
      problems.push(`${label} needs attention. It has been reversed.`);
      continue;
    }
    const debtorOk =
      params.direction === "sent"
        ? obligation.debtorMembershipId === params.actorMembershipId
        : obligation.debtorMembershipId === params.counterpartyMembershipId;
    const creditorOk =
      params.direction === "sent"
        ? obligation.creditorMembershipId === params.counterpartyMembershipId
        : obligation.creditorMembershipId === params.actorMembershipId;
    if (!debtorOk || !creditorOk) {
      problems.push(
        `${label} needs attention. It is not between you and the selected roommate.`,
      );
      continue;
    }
    const pending = Math.max(0, obligation.pendingPaymentCents);
    const available =
      params.direction === "received"
        ? obligation.officialOutstandingCents
        : Math.max(0, obligation.officialOutstandingCents - pending);
    if (row.amountCents > available) {
      problems.push(
        pending > 0 && params.direction === "sent"
          ? `${label} needs attention. A payment is already waiting, so only the remaining open amount can be included.`
          : `${label} needs attention. The amount is higher than what is still open.`,
      );
      continue;
    }
    sum += row.amountCents;
  }

  if (problems.length === 0 && sum !== params.totalAmountCents) {
    problems.push("The payment total does not match the selected expenses.");
  }

  if (problems.length > 0) {
    return { ok: false, ids, message: problems[0]! };
  }
  return { ok: true, ids };
}

/** Development-only diagnostic. Ids and counts, never amounts or names. */
export function logSettlementSelection(params: {
  submittedIds: readonly string[];
  eligibleCount: number;
}): void {
  if (process.env.NODE_ENV === "production") return;
  console.info(
    JSON.stringify({
      event: "settlement_selection",
      submittedCount: params.submittedIds.length,
      eligibleCount: params.eligibleCount,
      submittedIds: params.submittedIds,
    }),
  );
}

export function allocationsMatch(
  left: readonly SubmissionAllocation[],
  right: readonly SubmissionAllocation[],
): boolean {
  if (left.length !== right.length || left.length === 0) return false;
  const key = (rows: readonly SubmissionAllocation[]) =>
    [...rows]
      .map((row) => `${row.obligationId}:${row.amountCents}`)
      .sort()
      .join("|");
  return key(left) === key(right);
}
