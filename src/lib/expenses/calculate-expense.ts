/**
 * HouseholdOS expense calculation engine.
 *
 * ## Integer money
 * All monetary values are integer cents. Percentage and proportional math may
 * use rational intermediate values; final allocations are integer cents via
 * largest-fractional-remainder rounding (see rounding.ts).
 *
 * ## Proportional adjustment basis
 * Each member’s pre-adjustment allocated item subtotal ÷ total of those
 * subtotals. Excluded lines count toward the payer unless
 * `excludeFromAdjustmentBasis` is set. Discounts (negative adjustments) use
 * the same modes and reduce member obligations when allocated to them.
 *
 * ## Payer behavior
 * The payer may be allocated any share. That share is recorded in member
 * breakdowns but never creates a self-reimbursement obligation.
 *
 * ## Source of truth
 * The browser may preview; confirmation must reload draft inputs, recalculate
 * with this engine on the server, validate invariants, then confirm via RPC.
 */

import { allocateAdjustment } from "./allocate-adjustment";
import { allocateItem, buildProportionalBasis } from "./allocate-item";
import { buildMemberShares, buildObligations } from "./obligations";
import {
  assertAdjustmentReconciled,
  assertExpenseReconciled,
  assertItemReconciled,
  computeExpenseTotals,
} from "./reconcile";
import {
  ExpenseCalcError,
  type CalculateExpenseFailure,
  type CalculateExpenseInput,
  type CalculateExpenseResult,
} from "./types";

export function calculateExpense(
  input: CalculateExpenseInput,
): CalculateExpenseResult | CalculateExpenseFailure {
  try {
    return calculateExpenseOrThrow(input);
  } catch (error) {
    if (error instanceof ExpenseCalcError) {
      const totals = safeTotals(input);
      return {
        ok: false,
        code: error.code,
        message: error.message,
        reconciled: false,
        calculatedTotalCents: totals?.calculatedTotalCents,
        declaredTotalCents: input.declaredTotalCents,
      };
    }
    throw error;
  }
}

export function calculateExpenseOrThrow(
  input: CalculateExpenseInput,
): CalculateExpenseResult {
  if (input.currency !== input.householdCurrency) {
    throw new ExpenseCalcError(
      "currency_mismatch",
      `Expense currency ${input.currency} does not match household currency ${input.householdCurrency}`,
    );
  }

  if (!input.eligibleMembershipIds.includes(input.payerMembershipId)) {
    throw new ExpenseCalcError(
      "invalid_payer",
      "Payer must be an eligible active household member",
    );
  }

  if (!Number.isInteger(input.declaredTotalCents) || input.declaredTotalCents < 0) {
    throw new ExpenseCalcError(
      "incomplete_allocation",
      "Declared total must be a non-negative integer of cents",
    );
  }

  const totals = computeExpenseTotals(input);
  assertExpenseReconciled(totals.calculatedTotalCents, input.declaredTotalCents);

  const itemLines = input.items.map((item) =>
    allocateItem(item, input.eligibleMembershipIds),
  );
  for (const line of itemLines) assertItemReconciled(line);

  const proportionalBasis = buildProportionalBasis(
    input.items,
    itemLines,
    input.payerMembershipId,
    input.eligibleMembershipIds,
  );

  const adjustmentLines = input.adjustments.map((adj) =>
    allocateAdjustment(
      adj,
      input.eligibleMembershipIds,
      input.payerMembershipId,
      proportionalBasis,
    ),
  );
  for (const line of adjustmentLines) assertAdjustmentReconciled(line);

  const lines = [...itemLines, ...adjustmentLines];
  const memberShares = buildMemberShares(input.eligibleMembershipIds, lines);

  // Guard against pathological negative share totals after allocation
  // (beyond intentional discount flips handled in obligations).
  for (const share of memberShares) {
    // Individual line amounts may be negative (discounts). Net is allowed
    // to go negative; obligations builder flips creditor/debtor.
    if (!Number.isInteger(share.totalShareCents)) {
      throw new ExpenseCalcError(
        "invalid_negative_result",
        "Member share is not an integer cent amount",
      );
    }
  }

  // Sum of all member shares (including payer) must equal calculated total.
  const shareSum = memberShares.reduce((s, m) => s + m.totalShareCents, 0);
  // Excluded items are in the receipt total but not in member shares — add them back.
  const excludedTotal = itemLines
    .filter((l) => l.excluded)
    .reduce((s, l) => s + l.totalCents, 0);
  // Excluded amounts are absorbed by the payer for basis, but if excludeFromAdjustmentBasis
  // and excluded from allocations, they still count in declared total. For share sum:
  // member shares cover allocated items + adjustments; excluded lines not in shares.
  // Reconciliation: shareSum + excludedNotInShares should equal calculated total.
  // Excluded lines always contribute to declared total but never to allocations.
  // When excludeFromAdjustmentBasis is false they still don't appear in allocations —
  // they're payer-absorbed economically but not listed as an allocation row.
  // We treat excluded amount as part of payer's economic share for obligation purposes
  // only when included in basis — but allocation rows stay empty.
  // Therefore shareSum + excludedTotal must equal calculated total.
  if (shareSum + excludedTotal !== totals.calculatedTotalCents) {
    throw new ExpenseCalcError(
      "reconciliation_failure",
      `Member shares (${shareSum}) + excluded (${excludedTotal}) ≠ total (${totals.calculatedTotalCents})`,
    );
  }

  const obligations = buildObligations(input.payerMembershipId, memberShares);

  return {
    ok: true,
    itemSubtotalCents: totals.itemSubtotalCents,
    adjustmentsNetCents: totals.adjustmentsNetCents,
    calculatedTotalCents: totals.calculatedTotalCents,
    declaredTotalCents: input.declaredTotalCents,
    reconciled: true,
    lines,
    memberShares,
    proportionalBasis,
    obligations,
  };
}

function safeTotals(input: CalculateExpenseInput) {
  try {
    return computeExpenseTotals(input);
  } catch {
    return null;
  }
}

export {
  ExpenseCalcError,
  type CalculateExpenseInput,
  type CalculateExpenseResult,
  type CalculateExpenseFailure,
} from "./types";
