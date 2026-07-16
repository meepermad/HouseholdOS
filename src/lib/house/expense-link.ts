/**
 * Expense linkage rules: physical resources survive financial amendments/voids.
 */

export type ExpenseLinkInput = {
  resourceHouseholdId: string;
  expenseHouseholdId: string;
  expenseItemId: string;
  resourceType: "inventory" | "supply" | "pantry" | "shopping_item";
  resourceId: string;
  /** Existing active links for this expense item + resource */
  existingLinkIds?: readonly string[];
};

export function validateExpenseLink(
  input: ExpenseLinkInput,
): { ok: true } | { ok: false; error: string } {
  if (input.resourceHouseholdId !== input.expenseHouseholdId) {
    return {
      ok: false,
      error: "Expense and resource must belong to the same household",
    };
  }
  if (!input.expenseItemId || !input.resourceId) {
    return { ok: false, error: "Expense item and resource are required" };
  }
  if (input.existingLinkIds && input.existingLinkIds.length > 0) {
    return {
      ok: false,
      error: "Resource is already linked to this expense item",
    };
  }
  return { ok: true };
}

/**
 * When an expense is voided or amended, inventory/supply/pantry rows remain.
 * Financial correction and physical correction are separate workflows.
 */
export function expenseAmendmentDeletesResource(): boolean {
  return false;
}

export function expenseVoidDeletesResource(): boolean {
  return false;
}

export type AcquisitionCostCorrection = {
  previousPriceCents: number | null;
  newPriceCents: number | null;
  resourceRemains: true;
};

export function correctAcquisitionCost(params: {
  previousPriceCents: number | null;
  amendedExpenseItemCents: number | null;
}): AcquisitionCostCorrection {
  return {
    previousPriceCents: params.previousPriceCents,
    newPriceCents: params.amendedExpenseItemCents,
    resourceRemains: true,
  };
}
