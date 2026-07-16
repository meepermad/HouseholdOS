import { parseQuantity } from "./quantity";
import type {
  OwnershipMode,
  ShoppingItemStatus,
  ShoppingPriority,
} from "./types";
import {
  OPEN_SHOPPING_STATUSES,
  TERMINAL_SHOPPING_STATUSES,
} from "./types";
import { canTransitionShoppingStatus } from "./lifecycle";

export const SHOPPING_PRIORITIES = [
  "low",
  "normal",
  "high",
  "urgent",
] as const satisfies readonly ShoppingPriority[];

export const SHOPPING_PRIORITY_LABELS: Record<ShoppingPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

/** Soft threshold in cents for "Approval may be required" hint (not a workflow). */
export const DEFAULT_APPROVAL_HINT_CENTS = 5000;

export type ShoppingRequestInput = {
  name: string;
  quantity?: string | null;
  unit?: string | null;
  priority: ShoppingPriority;
  intendedOwnership: OwnershipMode;
  intendedOwnerMembershipId?: string | null;
  estimatedCostCents?: number | null;
  relatedSupplyId?: string | null;
  hasActiveRequestForSupply?: boolean;
  isDurableReplacement?: boolean;
};

export function validateShoppingRequest(
  input: ShoppingRequestInput,
): { ok: true } | { ok: false; error: string } {
  if (!input.name.trim()) {
    return { ok: false, error: "Name is required" };
  }
  if (input.quantity != null && input.quantity !== "") {
    const q = parseQuantity(input.quantity);
    if (!q.ok) return { ok: false, error: q.error };
  }
  if (
    (input.intendedOwnership === "personal" ||
      input.intendedOwnership === "temporary") &&
    !input.intendedOwnerMembershipId
  ) {
    return {
      ok: false,
      error: "Personal shopping items require an intended owner",
    };
  }
  if (
    input.relatedSupplyId &&
    input.hasActiveRequestForSupply
  ) {
    return {
      ok: false,
      error: "An active shopping request already exists for this supply",
    };
  }
  if (
    input.estimatedCostCents != null &&
    (input.estimatedCostCents < 0 ||
      !Number.isInteger(input.estimatedCostCents))
  ) {
    return { ok: false, error: "Estimated cost must be a non-negative integer" };
  }
  return { ok: true };
}

export function isOpenShoppingStatus(status: ShoppingItemStatus): boolean {
  return (OPEN_SHOPPING_STATUSES as readonly string[]).includes(status);
}

export function isTerminalShoppingStatus(status: ShoppingItemStatus): boolean {
  return (TERMINAL_SHOPPING_STATUSES as readonly string[]).includes(status);
}

export function canAssignShoppingItem(status: ShoppingItemStatus): boolean {
  return canTransitionShoppingStatus(status, "assigned");
}

export function canClaimShoppingItem(status: ShoppingItemStatus): boolean {
  return (
    status === "requested" ||
    status === "approved" ||
    status === "assigned"
  );
}

export function canMarkPurchased(status: ShoppingItemStatus): boolean {
  return canTransitionShoppingStatus(status, "purchased");
}

export function approvalMayBeRequired(params: {
  estimatedCostCents?: number | null;
  isDurable?: boolean;
  thresholdCents?: number;
}): boolean {
  const threshold = params.thresholdCents ?? DEFAULT_APPROVAL_HINT_CENTS;
  if (params.isDurable) return true;
  if (
    params.estimatedCostCents != null &&
    params.estimatedCostCents >= threshold
  ) {
    return true;
  }
  return false;
}

/**
 * Purchase completion must be idempotent: already-purchased returns same outcome.
 */
export function resolvePurchaseTransition(params: {
  currentStatus: ShoppingItemStatus;
}): "apply" | "idempotent_noop" | "reject" {
  if (params.currentStatus === "purchased") return "idempotent_noop";
  if (canMarkPurchased(params.currentStatus)) return "apply";
  return "reject";
}
