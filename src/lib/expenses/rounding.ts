/**
 * Deterministic integer-cent rounding for expense allocations.
 *
 * Algorithm (largest fractional remainder):
 * 1. For each participant, compute exactCents as a finite number
 *    (numerator * total / denominator using integer arithmetic where possible).
 * 2. Assign floor(exactCents) to each participant.
 * 3. Compute remaining = total - sum(floors).
 * 4. Sort participants by:
 *    a. fractional remainder descending (exactCents - floor)
 *    b. membership UUID ascending as stable tie-breaker
 * 5. Give one extra cent to the first `remaining` participants in that order.
 *
 * This avoids favoring the payer and is independent of object iteration order.
 */

import { ExpenseCalcError } from "./types";

export type ShareCandidate = {
  membershipId: string;
  /** Exact rational share in cents (may be fractional). */
  exactCents: number;
};

export function distributeByLargestRemainder(
  totalCents: number,
  candidates: readonly ShareCandidate[],
): Array<{ membershipId: string; amountCents: number }> {
  if (!Number.isInteger(totalCents)) {
    throw new ExpenseCalcError(
      "incomplete_allocation",
      "Total must be an integer number of cents",
    );
  }
  if (candidates.length === 0) {
    if (totalCents === 0) return [];
    throw new ExpenseCalcError("empty_participants", "No participants to allocate to");
  }

  const floored = candidates.map((c) => {
    const floor = Math.floor(c.exactCents);
    const fraction = c.exactCents - floor;
    return {
      membershipId: c.membershipId,
      floor,
      fraction,
    };
  });

  let assigned = floored.reduce((sum, c) => sum + c.floor, 0);
  let remaining = totalCents - assigned;

  // Guard against tiny floating error pushing floors over total.
  if (remaining < 0) {
    const sortedDown = [...floored].sort((a, b) => {
      if (a.fraction !== b.fraction) return a.fraction - b.fraction;
      return a.membershipId.localeCompare(b.membershipId);
    });
    let deficit = -remaining;
    for (const row of sortedDown) {
      if (deficit === 0) break;
      if (row.floor > 0) {
        row.floor -= 1;
        deficit -= 1;
        assigned -= 1;
      }
    }
    remaining = totalCents - assigned;
  }

  const ordered = [...floored].sort((a, b) => {
    if (b.fraction !== a.fraction) return b.fraction - a.fraction;
    return a.membershipId.localeCompare(b.membershipId);
  });

  const extras = new Map<string, number>();
  for (let i = 0; i < remaining; i += 1) {
    const target = ordered[i % ordered.length];
    if (!target) break;
    extras.set(target.membershipId, (extras.get(target.membershipId) ?? 0) + 1);
  }

  return floored.map((c) => ({
    membershipId: c.membershipId,
    amountCents: c.floor + (extras.get(c.membershipId) ?? 0),
  }));
}

/** Split total equally among membership IDs using largest-remainder + UUID tie-break. */
export function splitEvenlyDeterministic(
  totalCents: number,
  membershipIds: readonly string[],
): Array<{ membershipId: string; amountCents: number }> {
  const unique = [...new Set(membershipIds)].sort((a, b) => a.localeCompare(b));
  if (unique.length === 0) {
    throw new ExpenseCalcError("empty_participants", "No participants for equal split");
  }
  const n = unique.length;
  return distributeByLargestRemainder(
    totalCents,
    unique.map((membershipId) => ({
      membershipId,
      exactCents: totalCents / n,
    })),
  );
}

/** Allocate by positive integer weights. */
export function splitByWeights(
  totalCents: number,
  weights: ReadonlyArray<{ membershipId: string; weight: number }>,
): Array<{ membershipId: string; amountCents: number }> {
  if (weights.length === 0) {
    throw new ExpenseCalcError("empty_participants", "No weights provided");
  }
  for (const w of weights) {
    if (!Number.isInteger(w.weight) || w.weight <= 0) {
      throw new ExpenseCalcError(
        "invalid_weights",
        "Weights must be positive integers",
      );
    }
  }
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  return distributeByLargestRemainder(
    totalCents,
    weights.map((w) => ({
      membershipId: w.membershipId,
      exactCents: (totalCents * w.weight) / totalWeight,
    })),
  );
}

/**
 * Allocate by percentage basis points (100% = 10000 bps).
 * Requires exact sum of 10000.
 */
export function splitByPercentBps(
  totalCents: number,
  parts: ReadonlyArray<{ membershipId: string; percentBps: number }>,
): Array<{ membershipId: string; amountCents: number }> {
  if (parts.length === 0) {
    throw new ExpenseCalcError("empty_participants", "No percentage parts");
  }
  let sumBps = 0;
  for (const p of parts) {
    if (!Number.isInteger(p.percentBps) || p.percentBps < 0) {
      throw new ExpenseCalcError(
        "invalid_percentage_total",
        "Percentages must be non-negative integer basis points",
      );
    }
    sumBps += p.percentBps;
  }
  if (sumBps !== 10_000) {
    throw new ExpenseCalcError(
      "invalid_percentage_total",
      `Percentages must sum to 100% (10000 bps); got ${sumBps}`,
    );
  }
  return distributeByLargestRemainder(
    totalCents,
    parts.map((p) => ({
      membershipId: p.membershipId,
      exactCents: (totalCents * p.percentBps) / 10_000,
    })),
  );
}
