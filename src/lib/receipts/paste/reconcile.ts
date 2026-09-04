import { formatPastedUsd } from "./cents";
import type { ParsedPasteReceipt, PasteProblem } from "./parse";

export type PasteReconciliation = {
  receiptTotalCents: number;
  itemsCents: number;
  extrasCents: number;
  unaccountedCents: number;
  balanced: boolean;
  rows: Array<{ label: string; cents: number }>;
};

export function reconcilePastedReceipt(receipt: ParsedPasteReceipt): PasteReconciliation {
  const itemsCents = receipt.items.reduce((sum, item) => sum + item.totalCents, 0);
  const extrasCents =
    (receipt.taxCents ?? 0) +
    (receipt.tipCents ?? 0) +
    (receipt.feeCents ?? 0) -
    (receipt.discountCents ?? 0);
  const receiptTotalCents = receipt.totalCents ?? 0;
  const unaccountedCents = receiptTotalCents - itemsCents - extrasCents;
  return {
    receiptTotalCents,
    itemsCents,
    extrasCents,
    unaccountedCents,
    balanced: unaccountedCents === 0 && receipt.totalCents != null,
    rows: [
      { label: "Receipt total", cents: receiptTotalCents },
      { label: "Items", cents: itemsCents },
      { label: "Tax/fees/etc.", cents: extrasCents },
      { label: "Unaccounted", cents: unaccountedCents },
    ],
  };
}

export function pasteStatusCopy(
  receipt: ParsedPasteReceipt,
  problems: readonly PasteProblem[],
  reconciliation: PasteReconciliation,
): string {
  const reviewItems = receipt.items.filter((i) => i.needsReview).length;
  if (problems.some((p) => p.code === "paid_by_unmatched")) {
    return "Paid-by person could not be matched";
  }
  if (!reconciliation.balanced && receipt.totalCents != null && receipt.items.length > 0) {
    return "Total does not match items";
  }
  if (reviewItems > 0) {
    return reviewItems === 1 ? "1 item needs review" : `${reviewItems} items need review`;
  }
  if (problems.length === 0 && (reconciliation.balanced || receipt.items.length === 0)) {
    return "Read successfully";
  }
  return "We could not confidently understand part of this receipt.";
}

export function formatReconciliationUsd(cents: number): string {
  return formatPastedUsd(cents);
}
