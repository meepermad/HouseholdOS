/**
 * Quantity-aware receipt claims and conflict detection.
 * Database RPCs remain the source of truth; these helpers preview and test.
 */

import { splitByWeights, splitEvenlyDeterministic } from "@/lib/expenses/rounding";

export type LineClaim = {
  membershipId: string;
  /** Positive integer quantity claimed. 1 for indivisible items. */
  quantity: number;
  kind: "mine" | "assigned" | "shared" | "household" | "excluded" | "quantity";
};

export type ClaimConflict =
  | { type: "already_claimed"; membershipId: string }
  | { type: "overclaim"; remaining: number; requested: number }
  | { type: "finalized" }
  | { type: "not_claimable" };

export function lineQuantity(quantity: number | null | undefined): number {
  if (quantity == null || !Number.isFinite(quantity) || quantity <= 0) return 1;
  return Math.max(1, Math.round(quantity));
}

export function claimedQuantity(claims: readonly LineClaim[]): number {
  return claims
    .filter((c) => c.kind !== "excluded" && c.kind !== "shared" && c.kind !== "household")
    .reduce((sum, c) => sum + lineQuantity(c.quantity), 0);
}

export function remainingQuantity(
  totalQuantity: number | null | undefined,
  claims: readonly LineClaim[],
): number {
  return Math.max(0, lineQuantity(totalQuantity) - claimedQuantity(claims));
}

export function canClaimQuantity(input: {
  totalQuantity: number | null | undefined;
  existing: readonly LineClaim[];
  requestedQuantity: number;
  actorMembershipId: string;
  replaceOwn?: boolean;
}): { ok: true } | { ok: false; conflict: ClaimConflict } {
  const total = lineQuantity(input.totalQuantity);
  const requested = lineQuantity(input.requestedQuantity);
  const others = input.replaceOwn
    ? input.existing.filter((c) => c.membershipId !== input.actorMembershipId)
    : [...input.existing];

  const indivisible = total === 1;
  if (indivisible) {
    const blocker = others.find(
      (c) => c.kind === "mine" || c.kind === "assigned" || c.kind === "quantity",
    );
    if (blocker && requested > 0) {
      return {
        ok: false,
        conflict: { type: "already_claimed", membershipId: blocker.membershipId },
      };
    }
  }

  const used = claimedQuantity(others);
  if (used + requested > total) {
    return {
      ok: false,
      conflict: {
        type: "overclaim",
        remaining: Math.max(0, total - used),
        requested,
      },
    };
  }
  return { ok: true };
}

/**
 * Allocate a line's cents across quantity claims. Remainder uses UUID-stable
 * largest-remainder rounding so cents always sum to the line total.
 */
export function allocateQuantityClaims(input: {
  totalCents: number;
  totalQuantity: number | null | undefined;
  claims: readonly LineClaim[];
}): Array<{ membershipId: string; quantity: number; amountCents: number }> {
  const qtyClaims = input.claims.filter(
    (c) => c.kind === "mine" || c.kind === "assigned" || c.kind === "quantity",
  );
  if (qtyClaims.length === 0) return [];
  const weights = qtyClaims.map((c) => ({
    membershipId: c.membershipId,
    weight: lineQuantity(c.quantity),
  }));
  const split = splitByWeights(input.totalCents, weights);
  const byId = new Map(split.map((s) => [s.membershipId, s.amountCents]));
  return qtyClaims.map((c) => ({
    membershipId: c.membershipId,
    quantity: lineQuantity(c.quantity),
    amountCents: byId.get(c.membershipId) ?? 0,
  }));
}

export function allocateSharedLine(input: {
  totalCents: number;
  membershipIds: readonly string[];
}): Array<{ membershipId: string; amountCents: number }> {
  if (input.membershipIds.length === 0) return [];
  return splitEvenlyDeterministic(input.totalCents, input.membershipIds);
}

export function conflictUserMessage(
  conflict: ClaimConflict,
  nameOf?: (membershipId: string) => string,
): string {
  switch (conflict.type) {
    case "already_claimed": {
      const name = nameOf?.(conflict.membershipId) ?? "A roommate";
      return `${name} already claimed this item.`;
    }
    case "overclaim":
      return conflict.remaining === 0
        ? "Nothing is left to claim on this item."
        : `Only ${conflict.remaining} left to claim.`;
    case "finalized":
      return "This receipt is already submitted.";
    case "not_claimable":
      return "This receipt is not open for claiming.";
  }
}
