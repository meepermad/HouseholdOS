import type {
  AllocatedLine,
  MemberShareBreakdown,
  ReimbursementObligationPreview,
} from "./types";

export function buildMemberShares(
  eligibleMembershipIds: readonly string[],
  lines: readonly AllocatedLine[],
): MemberShareBreakdown[] {
  const map = new Map<string, MemberShareBreakdown>();
  for (const id of eligibleMembershipIds) {
    map.set(id, {
      membershipId: id,
      itemSubtotalCents: 0,
      adjustmentCents: 0,
      totalShareCents: 0,
      lines: [],
    });
  }

  for (const line of lines) {
    for (const alloc of line.allocations) {
      let share = map.get(alloc.membershipId);
      if (!share) {
        share = {
          membershipId: alloc.membershipId,
          itemSubtotalCents: 0,
          adjustmentCents: 0,
          totalShareCents: 0,
          lines: [],
        };
        map.set(alloc.membershipId, share);
      }
      if (line.sourceType === "item") {
        share.itemSubtotalCents += alloc.amountCents;
      } else {
        share.adjustmentCents += alloc.amountCents;
      }
      share.totalShareCents += alloc.amountCents;
      share.lines.push({
        sourceType: line.sourceType,
        sourceId: line.sourceId,
        description: line.description,
        amountCents: alloc.amountCents,
      });
    }
  }

  return [...map.values()]
    .map((s) => ({ ...s }))
    .sort((a, b) => a.membershipId.localeCompare(b.membershipId));
}

/**
 * Build obligations: each non-payer member owes the payer their total share.
 * Payer self-share is recorded in memberShares but never becomes an obligation.
 */
export function buildObligations(
  payerMembershipId: string,
  memberShares: readonly MemberShareBreakdown[],
): ReimbursementObligationPreview[] {
  const obligations: ReimbursementObligationPreview[] = [];

  for (const share of memberShares) {
    if (share.membershipId === payerMembershipId) continue;
    if (share.totalShareCents === 0) continue;

    // Discounts can drive a member's net share negative. Negative shares mean
    // the payer owes that member (role flip). For Phase 2 confirmation we only
    // emit positive debtor→creditor obligations; negative nets are flipped.
    if (share.totalShareCents > 0) {
      obligations.push({
        debtorMembershipId: share.membershipId,
        creditorMembershipId: payerMembershipId,
        amountCents: share.totalShareCents,
        lines: share.lines.filter((l) => l.amountCents !== 0),
      });
    } else {
      obligations.push({
        debtorMembershipId: payerMembershipId,
        creditorMembershipId: share.membershipId,
        amountCents: -share.totalShareCents,
        lines: share.lines
          .filter((l) => l.amountCents !== 0)
          .map((l) => ({ ...l, amountCents: -l.amountCents })),
      });
    }
  }

  // Collapse any accidental self-debt (should never happen).
  return obligations
    .filter((o) => o.debtorMembershipId !== o.creditorMembershipId)
    .filter((o) => o.amountCents > 0)
    .sort((a, b) => {
      const d = a.debtorMembershipId.localeCompare(b.debtorMembershipId);
      if (d !== 0) return d;
      return a.creditorMembershipId.localeCompare(b.creditorMembershipId);
    });
}
