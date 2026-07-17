import type { ExtractedLineItem } from "../types";
import { formatCentsAsUsd } from "../currency";

export type AdjustmentLine = {
  label: string;
  amountCents: number;
};

export type ReconciliationSummary = {
  receiptTotalCents: number | null;
  reviewedItemsCents: number;
  taxAndAdjustmentsCents: number;
  differenceCents: number | null;
  balanced: boolean;
  warnings: string[];
  display: {
    receiptTotal: string;
    reviewedItems: string;
    taxAndAdjustments: string;
    difference: string;
  };
};

function lineTotal(item: Pick<ExtractedLineItem, "totalPriceCents" | "quantity" | "unitPriceCents">): number {
  if (item.totalPriceCents != null) return item.totalPriceCents;
  if (item.unitPriceCents != null && item.quantity != null) {
    return Math.round(item.unitPriceCents * item.quantity);
  }
  return 0;
}

/**
 * Integer-cent reconciliation for review UI.
 * Never silently mutates item prices.
 */
export function buildReconciliationSummary(input: {
  lineItems: Array<Pick<ExtractedLineItem, "totalPriceCents" | "quantity" | "unitPriceCents"> & { excluded?: boolean }>;
  subtotalCents: number | null;
  taxCents: number | null;
  tipCents: number | null;
  discountCents: number | null;
  totalCents: number | null;
  adjustments?: AdjustmentLine[];
}): ReconciliationSummary {
  const warnings: string[] = [];
  const included = input.lineItems.filter((l) => !l.excluded);
  const reviewedItemsCents = included.reduce((sum, item) => sum + lineTotal(item), 0);
  const adjustmentsSum = (input.adjustments ?? []).reduce((s, a) => s + a.amountCents, 0);
  const taxAndAdjustmentsCents =
    (input.taxCents ?? 0) +
    (input.tipCents ?? 0) -
    (input.discountCents ?? 0) +
    adjustmentsSum;

  const composed = reviewedItemsCents + taxAndAdjustmentsCents;
  const receiptTotalCents = input.totalCents;
  const differenceCents =
    receiptTotalCents === null ? null : receiptTotalCents - composed;

  let balanced = true;
  if (receiptTotalCents !== null) {
    balanced = Math.abs(differenceCents ?? 0) <= 1;
    if (!balanced) {
      warnings.push(
        `Difference of ${formatCentsAsUsd(differenceCents ?? 0)}. Add an adjustment or correct items before confirming the expense.`,
      );
    }
  }

  if (
    input.subtotalCents !== null &&
    Math.abs(input.subtotalCents - reviewedItemsCents) > 1
  ) {
    warnings.push("Reviewed items do not match the receipt subtotal.");
  }

  return {
    receiptTotalCents,
    reviewedItemsCents,
    taxAndAdjustmentsCents,
    differenceCents,
    balanced,
    warnings,
    display: {
      receiptTotal:
        receiptTotalCents === null ? "—" : formatCentsAsUsd(receiptTotalCents),
      reviewedItems: formatCentsAsUsd(reviewedItemsCents),
      taxAndAdjustments: formatCentsAsUsd(taxAndAdjustmentsCents),
      difference:
        differenceCents === null ? "—" : formatCentsAsUsd(differenceCents),
    },
  };
}

export function computeAdjustmentToBalance(input: {
  reviewedItemsCents: number;
  taxCents: number;
  tipCents: number;
  discountCents: number;
  totalCents: number;
  existingAdjustmentsCents?: number;
}): number {
  const current =
    input.reviewedItemsCents +
    input.taxCents +
    input.tipCents -
    input.discountCents +
    (input.existingAdjustmentsCents ?? 0);
  return input.totalCents - current;
}
