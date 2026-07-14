import { distributeByLargestRemainder, splitByPercentBps, splitByWeights, splitEvenlyDeterministic } from "./rounding";
import {
  ExpenseCalcError,
  type AllocatedLine,
  type ExpenseAdjustmentInput,
  type MemberAmount,
} from "./types";

function assertEligible(
  membershipId: string,
  eligible: ReadonlySet<string>,
): void {
  if (!eligible.has(membershipId)) {
    throw new ExpenseCalcError(
      "invalid_allocation_target",
      `Membership ${membershipId} is not an eligible household member`,
    );
  }
}

export function allocateAdjustment(
  adjustment: ExpenseAdjustmentInput,
  eligibleMembershipIds: readonly string[],
  payerMembershipId: string,
  proportionalBasis: readonly MemberAmount[],
): AllocatedLine {
  if (!Number.isInteger(adjustment.amountCents)) {
    throw new ExpenseCalcError(
      "incomplete_allocation",
      "Adjustment amount must be an integer number of cents",
    );
  }

  const eligible = new Set(eligibleMembershipIds);
  const amount = adjustment.amountCents;

  const wrap = (allocations: MemberAmount[]): AllocatedLine => ({
    sourceType: "adjustment",
    sourceId: adjustment.id,
    description: adjustment.description,
    totalCents: amount,
    allocations,
  });

  // Zero-value adjustments create empty allocations but remain part of the record.
  if (amount === 0) {
    return wrap([]);
  }

  switch (adjustment.allocationMode) {
    case "payer_absorbs": {
      return wrap([{ membershipId: payerMembershipId, amountCents: amount }]);
    }
    case "assigned": {
      const owner = adjustment.assignedMembershipId;
      if (!owner) {
        throw new ExpenseCalcError(
          "incomplete_allocation",
          "Assigned adjustments require a membership",
        );
      }
      assertEligible(owner, eligible);
      return wrap([{ membershipId: owner, amountCents: amount }]);
    }
    case "equal_all": {
      return wrap(splitEvenlyDeterministic(amount, eligibleMembershipIds));
    }
    case "equal_selected": {
      const ids = (adjustment.participants ?? []).map((p) => p.membershipId);
      if (ids.length === 0) {
        throw new ExpenseCalcError(
          "empty_participants",
          "Equal-selected adjustment requires participants",
        );
      }
      for (const id of ids) assertEligible(id, eligible);
      return wrap(splitEvenlyDeterministic(amount, ids));
    }
    case "fixed_cents": {
      const parts = adjustment.participants ?? [];
      let sum = 0;
      const allocations: MemberAmount[] = [];
      for (const p of parts) {
        assertEligible(p.membershipId, eligible);
        const cents = p.fixedCents;
        if (cents === undefined || !Number.isInteger(cents)) {
          throw new ExpenseCalcError(
            "incomplete_allocation",
            "Fixed adjustment allocations require integer cents",
          );
        }
        sum += cents;
        allocations.push({ membershipId: p.membershipId, amountCents: cents });
      }
      if (sum !== amount) {
        throw new ExpenseCalcError(
          "invalid_fixed_total",
          `Fixed adjustment allocations sum to ${sum} but adjustment is ${amount}`,
        );
      }
      return wrap(allocations);
    }
    case "percentage": {
      const parts = adjustment.participants ?? [];
      for (const p of parts) assertEligible(p.membershipId, eligible);
      return wrap(
        splitByPercentBps(
          amount,
          parts.map((p) => ({
            membershipId: p.membershipId,
            percentBps: p.percentBps ?? 0,
          })),
        ),
      );
    }
    case "weighted": {
      const parts = adjustment.participants ?? [];
      for (const p of parts) assertEligible(p.membershipId, eligible);
      return wrap(
        splitByWeights(
          amount,
          parts.map((p) => ({
            membershipId: p.membershipId,
            weight: p.weight ?? 0,
          })),
        ),
      );
    }
    case "proportional": {
      const positiveBasis = proportionalBasis.filter((b) => b.amountCents > 0);
      const basisTotal = positiveBasis.reduce((s, b) => s + b.amountCents, 0);
      if (basisTotal <= 0) {
        // No item basis: fall back to equal among all eligible members.
        return wrap(splitEvenlyDeterministic(amount, eligibleMembershipIds));
      }
      return wrap(
        distributeByLargestRemainder(
          amount,
          positiveBasis.map((b) => ({
            membershipId: b.membershipId,
            exactCents: (amount * b.amountCents) / basisTotal,
          })),
        ),
      );
    }
    default: {
      const _exhaustive: never = adjustment.allocationMode;
      throw new ExpenseCalcError(
        "incomplete_allocation",
        `Unknown adjustment mode: ${_exhaustive}`,
      );
    }
  }
}
