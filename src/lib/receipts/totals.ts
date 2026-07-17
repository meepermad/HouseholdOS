import type { ExtractedLineItem } from "./types";

export type TotalsInput = {
  lineItems: Array<Pick<ExtractedLineItem, "totalPriceCents" | "quantity" | "unitPriceCents">>;
  subtotalCents: number | null;
  taxCents: number | null;
  tipCents: number | null;
  totalCents: number | null;
};

export type TotalsReconciliation = {
  lineSumCents: number;
  impliedSubtotalCents: number;
  expectedTotalCents: number | null;
  deltaCents: number | null;
  balanced: boolean;
  warnings: string[];
};

function lineTotal(item: TotalsInput["lineItems"][number]): number {
  if (item.totalPriceCents !== null && item.totalPriceCents !== undefined) {
    return item.totalPriceCents;
  }
  if (
    item.unitPriceCents !== null &&
    item.unitPriceCents !== undefined &&
    item.quantity !== null &&
    item.quantity !== undefined
  ) {
    return Math.round(item.unitPriceCents * item.quantity);
  }
  return 0;
}

/** Reconcile OCR line items against declared receipt totals (integer cents). */
export function reconcileLineItemsWithTotal(input: TotalsInput): TotalsReconciliation {
  const warnings: string[] = [];
  const lineSumCents = input.lineItems.reduce((sum, item) => sum + lineTotal(item), 0);
  const impliedSubtotalCents = input.subtotalCents ?? lineSumCents;

  if (input.subtotalCents !== null && Math.abs(input.subtotalCents - lineSumCents) > 1) {
    warnings.push("Line items do not match the subtotal.");
  }

  let expectedTotalCents: number | null = null;
  if (input.totalCents !== null) {
    expectedTotalCents = input.totalCents;
  } else if (input.subtotalCents !== null || lineSumCents > 0) {
    expectedTotalCents =
      impliedSubtotalCents + (input.taxCents ?? 0) + (input.tipCents ?? 0);
  }

  const deltaCents =
    expectedTotalCents === null ? null : expectedTotalCents - (impliedSubtotalCents + (input.taxCents ?? 0) + (input.tipCents ?? 0));

  // Prefer comparing declared total to subtotal+tax+tip when available
  let balanced = true;
  if (input.totalCents !== null) {
    const composed =
      (input.subtotalCents ?? lineSumCents) + (input.taxCents ?? 0) + (input.tipCents ?? 0);
    const gap = Math.abs(input.totalCents - composed);
    balanced = gap <= 1;
    if (!balanced) {
      warnings.push("Total does not match subtotal + tax + tip.");
    }
  }

  return {
    lineSumCents,
    impliedSubtotalCents,
    expectedTotalCents,
    deltaCents,
    balanced,
    warnings,
  };
}
