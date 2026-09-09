import { formatPastedUsd } from "./cents";
import {
  looksLikePastedSourceLine,
  resolvePastedDisplayDescription,
} from "./display-description";
import {
  PASTE_FORMAT_VERSION,
  RECEIPT_FORMAT_END,
  RECEIPT_FORMAT_HEADER,
  RECEIPT_FORMAT_ITEMS,
} from "./format";

export type StoredReceiptPasteInput = {
  merchant?: string | null;
  purchaseDate?: string | null;
  totalCents?: number | null;
  subtotalCents?: number | null;
  taxCents?: number | null;
  tipCents?: number | null;
  feeCents?: number | null;
  discountCents?: number | null;
  items: Array<{
    description?: string | null;
    sourceText?: string | null;
    totalCents?: number | null;
    quantity?: number | null;
  }>;
};

function moneyLine(label: string, cents: number | null | undefined): string | null {
  if (cents == null || !Number.isFinite(cents)) return null;
  return `${label}: ${formatPastedUsd(cents)}`;
}

function itemLine(item: StoredReceiptPasteInput["items"][number]): string {
  const source = (item.sourceText ?? "").trim();
  if (looksLikePastedSourceLine(source)) return source;
  const name =
    resolvePastedDisplayDescription({
      correctedName: item.description,
      sourceText: source,
    }) || "Item";
  const qty = item.quantity != null && item.quantity > 0 ? item.quantity : 1;
  return `${name} | ${formatPastedUsd(item.totalCents ?? 0)} | ${qty}`;
}

/** Rebuild a HouseholdOS paste block from stored receipt fields. */
export function householdOsPasteFromStoredReceipt(
  input: StoredReceiptPasteInput,
): string {
  const header = [
    RECEIPT_FORMAT_HEADER,
    "",
    `Merchant: ${(input.merchant ?? "").trim() || "Receipt"}`,
    input.purchaseDate ? `Date: ${input.purchaseDate}` : null,
    moneyLine("Total", input.totalCents),
    moneyLine("Subtotal", input.subtotalCents),
    moneyLine("Tax", input.taxCents),
    moneyLine("Tip", input.tipCents),
    moneyLine("Fees", input.feeCents),
    moneyLine("Discount", input.discountCents),
    `Format: ${PASTE_FORMAT_VERSION}`,
    "",
    RECEIPT_FORMAT_ITEMS,
    ...input.items.map(itemLine),
    "",
    RECEIPT_FORMAT_END,
  ].filter((line) => line != null);
  return `${header.join("\n")}\n`;
}

export function preferExistingPasteText(
  candidates: Array<string | null | undefined>,
): string | null {
  for (const candidate of candidates) {
    const text = String(candidate ?? "").trim();
    if (!text) continue;
    if (/householdos\s+receipt/i.test(text) || looksLikePastedSourceLine(text)) {
      return text;
    }
  }
  const first = candidates.find((c) => String(c ?? "").trim());
  return first ? String(first).trim() : null;
}
