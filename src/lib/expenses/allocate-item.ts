import {
  splitByPercentBps,
  splitByWeights,
  splitEvenlyDeterministic,
} from "./rounding";
import {
  ExpenseCalcError,
  type AllocatedLine,
  type ExpenseItemInput,
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

function assertPositiveTotal(totalCents: number): void {
  if (!Number.isInteger(totalCents) || totalCents < 0) {
    throw new ExpenseCalcError(
      "incomplete_allocation",
      "Line total must be a non-negative integer of cents",
    );
  }
}

export function allocateItem(
  item: ExpenseItemInput,
  eligibleMembershipIds: readonly string[],
): AllocatedLine {
  assertPositiveTotal(item.totalCents);
  const eligible = new Set(eligibleMembershipIds);

  const wrap = (
    allocations: MemberAmount[],
    excluded = false,
  ): AllocatedLine => ({
    sourceType: "item",
    sourceId: item.id,
    description: item.description,
    totalCents: item.totalCents,
    allocations,
    excluded,
  });

  switch (item.allocationMode) {
    case "excluded": {
      // No reimbursement allocations. Basis participation is handled upstream.
      return wrap([], true);
    }
    case "personal": {
      const owner = item.personalMembershipId;
      if (!owner) {
        throw new ExpenseCalcError(
          "incomplete_allocation",
          "Personal items require an owner membership",
        );
      }
      assertEligible(owner, eligible);
      return wrap([{ membershipId: owner, amountCents: item.totalCents }]);
    }
    case "equal_all": {
      return wrap(
        splitEvenlyDeterministic(item.totalCents, eligibleMembershipIds),
      );
    }
    case "equal_selected": {
      const ids = (item.participants ?? []).map((p) => p.membershipId);
      if (ids.length === 0) {
        throw new ExpenseCalcError(
          "empty_participants",
          "Equal-selected split requires participants",
        );
      }
      for (const id of ids) assertEligible(id, eligible);
      return wrap(splitEvenlyDeterministic(item.totalCents, ids));
    }
    case "fixed_cents": {
      const parts = item.participants ?? [];
      if (parts.length === 0) {
        throw new ExpenseCalcError(
          "empty_participants",
          "Fixed allocation requires participants",
        );
      }
      let sum = 0;
      const allocations: MemberAmount[] = [];
      for (const p of parts) {
        assertEligible(p.membershipId, eligible);
        const cents = p.fixedCents;
        if (cents === undefined || !Number.isInteger(cents) || cents < 0) {
          throw new ExpenseCalcError(
            "incomplete_allocation",
            "Fixed allocations require non-negative integer cents",
          );
        }
        sum += cents;
        allocations.push({ membershipId: p.membershipId, amountCents: cents });
      }
      if (sum !== item.totalCents) {
        throw new ExpenseCalcError(
          "invalid_fixed_total",
          `Fixed allocations sum to ${sum} but line total is ${item.totalCents}`,
        );
      }
      return wrap(allocations);
    }
    case "percentage": {
      const parts = item.participants ?? [];
      for (const p of parts) assertEligible(p.membershipId, eligible);
      return wrap(
        splitByPercentBps(
          item.totalCents,
          parts.map((p) => ({
            membershipId: p.membershipId,
            percentBps: p.percentBps ?? 0,
          })),
        ),
      );
    }
    case "weighted": {
      const parts = item.participants ?? [];
      for (const p of parts) assertEligible(p.membershipId, eligible);
      return wrap(
        splitByWeights(
          item.totalCents,
          parts.map((p) => ({
            membershipId: p.membershipId,
            weight: p.weight ?? 0,
          })),
        ),
      );
    }
    default: {
      const _exhaustive: never = item.allocationMode;
      throw new ExpenseCalcError(
        "incomplete_allocation",
        `Unknown allocation mode: ${_exhaustive}`,
      );
    }
  }
}

/**
 * Build the pre-adjustment proportional basis.
 *
 * - Personal / shared allocations count toward the assigned members.
 * - Excluded lines count toward the payer unless excludeFromAdjustmentBasis.
 */
export function buildProportionalBasis(
  items: readonly ExpenseItemInput[],
  itemLines: readonly AllocatedLine[],
  payerMembershipId: string,
  eligibleMembershipIds: readonly string[],
): MemberAmount[] {
  const map = new Map<string, number>();
  for (const id of eligibleMembershipIds) map.set(id, 0);

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]!;
    const line = itemLines[i]!;

    if (item.allocationMode === "excluded") {
      if (!item.excludeFromAdjustmentBasis) {
        map.set(
          payerMembershipId,
          (map.get(payerMembershipId) ?? 0) + item.totalCents,
        );
      }
      continue;
    }

    for (const alloc of line.allocations) {
      map.set(
        alloc.membershipId,
        (map.get(alloc.membershipId) ?? 0) + alloc.amountCents,
      );
    }
  }

  return [...map.entries()]
    .filter(([, amountCents]) => amountCents !== 0)
    .map(([membershipId, amountCents]) => ({ membershipId, amountCents }))
    .sort((a, b) => a.membershipId.localeCompare(b.membershipId));
}
