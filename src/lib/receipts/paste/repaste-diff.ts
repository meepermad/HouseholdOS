import { formatCentsAsUsd } from "@/lib/receipts/currency";
import { claimedQuantity, lineQuantity, remainingQuantity } from "@/lib/receipts/claims";
import type { ParsedPasteItem, ParsedPasteReceipt } from "./parse";
import { reconcilePastedReceipt } from "./reconcile";
import { type ReconcileCurrentLine, type ReconciledLine } from "./line-reconcile";
import { displayDescriptionFromPastedSource } from "./display-description";

export type RepasteChangeKind =
  | "description_changed"
  | "price_changed"
  | "quantity_changed"
  | "item_added"
  | "item_removed"
  | "merchant_changed"
  | "date_changed"
  | "subtotal_changed"
  | "tax_changed"
  | "tip_changed"
  | "fees_changed"
  | "discount_changed"
  | "total_changed";

export type RepasteDiffRow = {
  kind: RepasteChangeKind;
  label: string;
  detail: string;
  lineId?: string;
  incomingIndex?: number;
  oldName?: string;
  newName?: string;
  oldCents?: number | null;
  newCents?: number | null;
  oldQuantity?: number | null;
  newQuantity?: number | null;
  unchanged?: boolean;
  claimedByLabel?: string | null;
  remainingUnclaimed?: number;
  descriptionConflict?: boolean;
};

export const REPASTE_CHANGE_LABELS: Record<RepasteChangeKind, string> = {
  description_changed: "Item name changed",
  price_changed: "Price changed",
  quantity_changed: "Quantity changed",
  item_added: "This item was added",
  item_removed: "This item was removed",
  merchant_changed: "Merchant changed",
  date_changed: "Date changed",
  subtotal_changed: "Subtotal changed",
  tax_changed: "Tax changed",
  tip_changed: "Tip changed",
  fees_changed: "Fees changed",
  discount_changed: "Discount changed",
  total_changed: "Receipt total changed",
};

function incomingName(item: ParsedPasteItem): string {
  return item.description.trim() || displayDescriptionFromPastedSource(item.raw);
}

function signedDelta(from: number, to: number): string {
  const delta = to - from;
  if (delta === 0) return "No change";
  const abs = formatCentsAsUsd(Math.abs(delta));
  return delta > 0 ? `Price changed by +${abs}` : `Price changed by -${abs}`;
}

function headerArrow(
  label: string,
  kind: RepasteChangeKind,
  from: string,
  to: string,
): RepasteDiffRow {
  const unchanged = from === to;
  return {
    kind,
    label,
    detail: unchanged ? `${from} → ${to}\nNo change` : `${from} → ${to}`,
    unchanged,
    oldName: from,
    newName: to,
  };
}

function moneyLabel(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return formatCentsAsUsd(cents);
}

export type CurrentRepasteClaim = {
  membershipId: string;
  quantity: number;
  kind: "mine" | "assigned" | "shared" | "household" | "excluded" | "quantity";
  memberLabel?: string;
};

export type CurrentRepasteLine = ReconcileCurrentLine & {
  descriptionEditedByUser?: boolean;
  classification?: string;
  participantMembershipIds?: string[];
  claims?: CurrentRepasteClaim[];
};

export function claimedOwnerLabel(claims: readonly CurrentRepasteClaim[] | undefined): string | null {
  const owners = (claims ?? []).filter(
    (c) => c.kind === "mine" || c.kind === "assigned" || c.kind === "quantity",
  );
  if (owners.length === 0) return null;
  const names = owners.map((c) => c.memberLabel || "a roommate");
  return names.join(", ");
}

export function lineHasOwnership(line: CurrentRepasteLine): boolean {
  if ((line.participantMembershipIds ?? []).length > 0) return true;
  const classification = line.classification;
  if (
    classification &&
    classification !== "needs_review" &&
    classification !== "excluded"
  ) {
    return true;
  }
  return (line.claims ?? []).some(
    (c) => c.kind === "mine" || c.kind === "assigned" || c.kind === "quantity",
  );
}

export function buildRepasteDiffRows(input: {
  current: {
    merchant: string | null;
    purchaseDate: string | null;
    totalCents: number | null;
    subtotalCents: number | null;
    taxCents: number | null;
    tipCents: number | null;
    feeCents: number | null;
    discountCents: number | null;
    lines: CurrentRepasteLine[];
  };
  incoming: ParsedPasteReceipt;
  matches: readonly ReconciledLine[];
}): RepasteDiffRow[] {
  const rows: RepasteDiffRow[] = [];
  const currentById = new Map(input.current.lines.map((l) => [l.id, l]));

  rows.push(
    headerArrow(
      "Merchant",
      "merchant_changed",
      input.current.merchant?.trim() || "—",
      input.incoming.merchant?.trim() || "—",
    ),
  );
  rows.push(
    headerArrow(
      "Date",
      "date_changed",
      input.current.purchaseDate || "—",
      input.incoming.purchaseDate || "—",
    ),
  );
  rows.push(
    headerArrow(
      "Total",
      "total_changed",
      moneyLabel(input.current.totalCents),
      moneyLabel(input.incoming.totalCents),
    ),
  );
  if (input.current.subtotalCents != null || input.incoming.subtotalCents != null) {
    rows.push(
      headerArrow(
        "Subtotal",
        "subtotal_changed",
        moneyLabel(input.current.subtotalCents),
        moneyLabel(input.incoming.subtotalCents),
      ),
    );
  }
  if (input.current.taxCents != null || input.incoming.taxCents != null) {
    rows.push(
      headerArrow(
        "Tax",
        "tax_changed",
        moneyLabel(input.current.taxCents),
        moneyLabel(input.incoming.taxCents),
      ),
    );
  }
  if (input.current.tipCents != null || input.incoming.tipCents != null) {
    rows.push(
      headerArrow(
        "Tip",
        "tip_changed",
        moneyLabel(input.current.tipCents),
        moneyLabel(input.incoming.tipCents),
      ),
    );
  }
  if (input.current.feeCents != null || input.incoming.feeCents != null) {
    rows.push(
      headerArrow(
        "Fees",
        "fees_changed",
        moneyLabel(input.current.feeCents),
        moneyLabel(input.incoming.feeCents),
      ),
    );
  }
  if (input.current.discountCents != null || input.incoming.discountCents != null) {
    rows.push(
      headerArrow(
        "Discount",
        "discount_changed",
        moneyLabel(input.current.discountCents),
        moneyLabel(input.incoming.discountCents),
      ),
    );
  }

  for (const match of input.matches) {
    if (match.action === "add") {
      rows.push({
        kind: "item_added",
        label: incomingName(match.incoming),
        detail: `New:\n${incomingName(match.incoming)}\n${formatCentsAsUsd(match.incoming.totalCents)}\nQty ${lineQuantity(match.incoming.quantity)}`,
        incomingIndex: match.incomingIndex,
        newName: incomingName(match.incoming),
        newCents: match.incoming.totalCents,
        newQuantity: lineQuantity(match.incoming.quantity),
      });
      continue;
    }
    if (match.action === "remove") {
      const current = match.current;
      const owner = claimedOwnerLabel(currentById.get(current.id)?.claims);
      rows.push({
        kind: "item_removed",
        label: current.displayDescription,
        detail: owner
          ? `${current.displayDescription} currently belongs to ${owner}. This corrected receipt removes it.`
          : `Old:\n${current.displayDescription}\n${formatCentsAsUsd(current.totalCents)}\nQty ${lineQuantity(current.quantity)}`,
        lineId: current.id,
        oldName: current.displayDescription,
        oldCents: current.totalCents,
        oldQuantity: lineQuantity(current.quantity),
        claimedByLabel: owner,
      });
      continue;
    }

    const current = currentById.get(match.currentId);
    if (!current) continue;
    const nextName = incomingName(match.incoming);
    const descConflict = Boolean(
      current.descriptionEditedByUser &&
        descKeySafe(current.displayDescription) !== descKeySafe(nextName),
    );
    const qty = lineQuantity(match.incoming.quantity);
    const claimed = claimedQuantity(current.claims ?? []);
    const remaining = remainingQuantity(qty, current.claims ?? []);

    if (match.kind === "unchanged") {
      rows.push({
        kind: "description_changed",
        label: current.displayDescription,
        detail: `${current.displayDescription}\n→ ${nextName}\nNo change`,
        lineId: current.id,
        incomingIndex: match.incomingIndex,
        oldName: current.displayDescription,
        newName: nextName,
        oldCents: current.totalCents,
        newCents: match.incoming.totalCents,
        oldQuantity: lineQuantity(current.quantity),
        newQuantity: qty,
        unchanged: true,
        descriptionConflict: descConflict,
      });
      continue;
    }

    const parts: string[] = [
      `Old:\n${current.displayDescription}\n${formatCentsAsUsd(current.totalCents)}\nQty ${lineQuantity(current.quantity)}`,
      `New:\n${nextName}\n${formatCentsAsUsd(match.incoming.totalCents)}\nQty ${qty}`,
    ];
    if (match.kind === "description" || match.kind.includes("description")) {
      parts.push(descConflict ? "Current name differs from the new transcription" : "Item name changed");
    }
    if (match.kind === "price" || match.kind.includes("price")) {
      parts.push(signedDelta(current.totalCents, match.incoming.totalCents));
    }
    if (match.kind === "quantity" || match.kind.includes("quantity")) {
      parts.push("Quantity changed");
      if (qty > lineQuantity(current.quantity) && remaining > 0) {
        parts.push(
          remaining === 1 ? "1 unit remains unclaimed" : `${remaining} units remain unclaimed`,
        );
      }
      if (claimed > qty) {
        parts.push("Claim needs review");
      }
    }

    rows.push({
      kind: primaryItemChangeKind({
        descriptionChanged: descKeySafe(current.displayDescription) !== descKeySafe(nextName),
        priceChanged: current.totalCents !== match.incoming.totalCents,
        quantityChanged: lineQuantity(current.quantity) !== qty,
      }),
      label: current.displayDescription,
      detail: parts.join("\n\n"),
      lineId: current.id,
      incomingIndex: match.incomingIndex,
      oldName: current.displayDescription,
      newName: nextName,
      oldCents: current.totalCents,
      newCents: match.incoming.totalCents,
      oldQuantity: lineQuantity(current.quantity),
      newQuantity: qty,
      remainingUnclaimed: remaining,
      descriptionConflict: descConflict,
    });
  }

  return rows;
}

function descKeySafe(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function primaryItemChangeKind(flags: {
  descriptionChanged: boolean;
  priceChanged: boolean;
  quantityChanged: boolean;
}): RepasteChangeKind {
  if (flags.priceChanged) return "price_changed";
  if (flags.quantityChanged) return "quantity_changed";
  if (flags.descriptionChanged) return "description_changed";
  return "description_changed";
}

export function summarizeRepasteFinancial(rows: readonly RepasteDiffRow[]): {
  descriptionOnly: boolean;
  financialChanged: boolean;
  itemsChanged: boolean;
} {
  const material = rows.filter((row) => !row.unchanged);
  const financialKinds: RepasteChangeKind[] = [
    "price_changed",
    "quantity_changed",
    "item_added",
    "item_removed",
    "subtotal_changed",
    "tax_changed",
    "tip_changed",
    "fees_changed",
    "discount_changed",
    "total_changed",
  ];
  const financialChanged = material.some((row) => financialKinds.includes(row.kind));
  const itemsChanged = material.some((row) =>
    ["description_changed", "price_changed", "quantity_changed", "item_added", "item_removed"].includes(
      row.kind,
    ),
  );
  return {
    descriptionOnly: itemsChanged && !financialChanged,
    financialChanged,
    itemsChanged,
  };
}

export function incomingReconciliation(receipt: ParsedPasteReceipt) {
  return reconcilePastedReceipt(receipt);
}
