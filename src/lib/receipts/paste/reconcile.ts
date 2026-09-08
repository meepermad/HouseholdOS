import { formatPastedUsd } from "./cents";
import type { ParsedPasteReceipt, PasteProblem } from "./parse";
import { itemLineIssues } from "./problems";

export type PasteReconciliation = {
  receiptTotalCents: number;
  itemsCents: number;
  extrasCents: number;
  accountedForCents: number;
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
  const accountedForCents = itemsCents + extrasCents;
  const unaccountedCents = receiptTotalCents - accountedForCents;
  return {
    receiptTotalCents,
    itemsCents,
    extrasCents,
    accountedForCents,
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
  const lineIssues = itemLineIssues(problems);
  if (lineIssues.length > 0) {
    const read = receipt.items.length;
    const needs = lineIssues.length;
    const readLabel = read === 1 ? "1 item read" : `${read} items read`;
    const needLabel = needs === 1 ? "1 item needs review" : `${needs} items need review`;
    return `${readLabel} · ${needLabel}`;
  }
  if (problems.some((p) => p.code === "paid_by_unmatched")) {
    return "Paid-by person could not be matched";
  }
  if (!reconciliation.balanced && receipt.totalCents != null) {
    return "These numbers don't add up yet.";
  }
  const reviewItems = receipt.items.filter((i) => i.needsReview).length;
  if (reviewItems > 0) {
    return reviewItems === 1 ? "1 item needs review" : `${reviewItems} items need review`;
  }
  if (problems.every((p) => p.severity !== "blocker")) {
    return "Read successfully";
  }
  return "We found the receipt, but some details need review.";
}

export function formatReconciliationUsd(cents: number): string {
  return formatPastedUsd(cents);
}
