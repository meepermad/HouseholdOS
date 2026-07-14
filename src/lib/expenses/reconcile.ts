import {
  ExpenseCalcError,
  type AllocatedLine,
  type CalculateExpenseInput,
} from "./types";

export function sumAllocations(line: AllocatedLine): number {
  return line.allocations.reduce((s, a) => s + a.amountCents, 0);
}

/** For non-excluded item lines, allocations must sum to the line total. */
export function assertItemReconciled(line: AllocatedLine): void {
  if (line.excluded) {
    if (line.allocations.length > 0) {
      throw new ExpenseCalcError(
        "reconciliation_failure",
        "Excluded items must not have allocations",
      );
    }
    return;
  }
  const sum = sumAllocations(line);
  if (sum !== line.totalCents) {
    throw new ExpenseCalcError(
      "reconciliation_failure",
      `Item ${line.sourceId}: allocations sum to ${sum}, expected ${line.totalCents}`,
    );
  }
}

export function assertAdjustmentReconciled(line: AllocatedLine): void {
  if (line.totalCents === 0) {
    if (line.allocations.length > 0 && sumAllocations(line) !== 0) {
      throw new ExpenseCalcError(
        "reconciliation_failure",
        `Zero adjustment ${line.sourceId} has non-zero allocations`,
      );
    }
    return;
  }
  const sum = sumAllocations(line);
  if (sum !== line.totalCents) {
    throw new ExpenseCalcError(
      "reconciliation_failure",
      `Adjustment ${line.sourceId}: allocations sum to ${sum}, expected ${line.totalCents}`,
    );
  }
}

/**
 * Expense reconciliation:
 * sum(line item totals) + sum(adjustment amounts) = declared total
 *
 * Excluded items still contribute to the receipt total.
 */
export function computeExpenseTotals(input: CalculateExpenseInput): {
  itemSubtotalCents: number;
  adjustmentsNetCents: number;
  calculatedTotalCents: number;
} {
  const itemSubtotalCents = input.items.reduce(
    (s, i) => s + i.totalCents,
    0,
  );
  const adjustmentsNetCents = input.adjustments.reduce(
    (s, a) => s + a.amountCents,
    0,
  );
  return {
    itemSubtotalCents,
    adjustmentsNetCents,
    calculatedTotalCents: itemSubtotalCents + adjustmentsNetCents,
  };
}

export function assertExpenseReconciled(
  calculatedTotalCents: number,
  declaredTotalCents: number,
): void {
  if (calculatedTotalCents !== declaredTotalCents) {
    throw new ExpenseCalcError(
      "reconciliation_failure",
      `Calculated total ${calculatedTotalCents} does not match declared total ${declaredTotalCents}`,
    );
  }
}
