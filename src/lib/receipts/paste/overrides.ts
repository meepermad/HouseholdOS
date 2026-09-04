import { parsePastedCents } from "./cents";
import type { ParsedPasteItem, ParsedPasteReceipt } from "./parse";

export type PasteEditInput = {
  merchant?: string | null;
  purchaseDate?: string | null;
  totalCents?: number | null;
  payerMembershipId?: string | null;
  totalOnly?: boolean;
  items?: Array<{
    description: string;
    totalCents: number;
    quantity?: number;
  }>;
};

function asIntCents(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (typeof value === "string") {
    const parsed = parsePastedCents(value);
    return parsed.ok ? parsed.cents : null;
  }
  return null;
}

/** Apply roommate edits after review. Rejects non-integer money. */
export function applyPasteEdits(
  receipt: ParsedPasteReceipt,
  edit: PasteEditInput | null,
): ParsedPasteReceipt | { error: string } {
  if (!edit) return receipt;
  const next: ParsedPasteReceipt = { ...receipt, items: [...receipt.items] };

  if (typeof edit.merchant === "string") {
    const merchant = edit.merchant.trim().slice(0, 200);
    if (!merchant) return { error: "This receipt still needs a store name." };
    next.merchant = merchant;
  }
  if (edit.purchaseDate !== undefined) {
    next.purchaseDate = edit.purchaseDate;
  }
  if (edit.totalCents !== undefined) {
    const cents = asIntCents(edit.totalCents);
    if (cents == null || cents < 0) return { error: "The receipt total is not a valid amount." };
    next.totalCents = cents;
  }
  if (edit.payerMembershipId !== undefined) {
    next.payerMembershipId = edit.payerMembershipId;
  }
  if (edit.totalOnly) {
    next.items = [];
    return next;
  }
  if (edit.items) {
    const items: ParsedPasteItem[] = [];
    for (const row of edit.items) {
      const cents = asIntCents(row.totalCents);
      if (cents == null || cents < 0) return { error: "One of the item amounts is not valid." };
      const quantity = row.quantity && Number.isSafeInteger(row.quantity) && row.quantity > 0
        ? row.quantity
        : 1;
      const description = String(row.description ?? "").trim().slice(0, 200);
      if (!description) return { error: "Every item needs a name." };
      items.push({
        description,
        totalCents: cents,
        quantity,
        ownershipHint: null,
        ownershipKind: null,
        suggestedMembershipId: null,
        needsReview: false,
        raw: `${description} | ${cents} | ${quantity}`,
      });
    }
    next.items = items;
  }
  return next;
}
