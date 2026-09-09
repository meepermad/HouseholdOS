import { lineQuantity } from "@/lib/receipts/claims";
import type { ParsedPasteItem } from "./parse";
import { displayDescriptionFromPastedSource } from "./display-description";

export type ReconcileCurrentLine = {
  id: string;
  sortIndex: number;
  displayDescription: string;
  sourceText: string;
  totalCents: number;
  quantity: number;
};

export type LineMatchKind =
  | "unchanged"
  | "description"
  | "price"
  | "quantity"
  | "description_and_price"
  | "description_and_quantity"
  | "price_and_quantity"
  | "metadata";

export type ReconciledLine =
  | {
      action: "keep" | "update";
      currentId: string;
      incomingIndex: number;
      incoming: ParsedPasteItem;
      kind: LineMatchKind;
    }
  | {
      action: "remove";
      currentId: string;
      current: ReconcileCurrentLine;
    }
  | {
      action: "add";
      incomingIndex: number;
      incoming: ParsedPasteItem;
    };

function qtyOf(value: number | null | undefined): number {
  return lineQuantity(value);
}

function descKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function descriptionsRelated(a: string, b: string): boolean {
  const x = descKey(a);
  const y = descKey(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.includes(y) || y.includes(x)) return true;
  const xTokens = new Set(x.split(" ").filter((t) => t.length >= 3));
  const yTokens = y.split(" ").filter((t) => t.length >= 3);
  if (xTokens.size === 0 || yTokens.length === 0) return false;
  let overlap = 0;
  for (const token of yTokens) {
    if (xTokens.has(token)) overlap += 1;
  }
  return overlap >= Math.min(2, Math.min(xTokens.size, yTokens.length));
}

function incomingDescription(item: ParsedPasteItem): string {
  return (
    item.description.trim() || displayDescriptionFromPastedSource(item.raw)
  );
}

function matchKind(
  current: ReconcileCurrentLine,
  incoming: ParsedPasteItem,
): LineMatchKind {
  const descChanged =
    descKey(current.displayDescription) !== descKey(incomingDescription(incoming));
  const priceChanged = current.totalCents !== incoming.totalCents;
  const qtyChanged = qtyOf(current.quantity) !== qtyOf(incoming.quantity);
  if (!descChanged && !priceChanged && !qtyChanged) return "unchanged";
  if (descChanged && priceChanged && qtyChanged) return "metadata";
  if (descChanged && priceChanged) return "description_and_price";
  if (descChanged && qtyChanged) return "description_and_quantity";
  if (priceChanged && qtyChanged) return "price_and_quantity";
  if (descChanged) return "description";
  if (priceChanged) return "price";
  if (qtyChanged) return "quantity";
  return "metadata";
}

function asKeep(
  current: ReconcileCurrentLine,
  incomingIndex: number,
  incoming: ParsedPasteItem,
): ReconciledLine {
  return {
    action: matchKind(current, incoming) === "unchanged" ? "keep" : "update",
    currentId: current.id,
    incomingIndex,
    incoming,
    kind: matchKind(current, incoming),
  };
}

/**
 * Deterministic line identity. Prefers same order + amount + quantity, then
 * unique amount/quantity, then related descriptions. No AI matching.
 */
export function reconcileReceiptLines(
  current: readonly ReconcileCurrentLine[],
  incoming: readonly ParsedPasteItem[],
): ReconciledLine[] {
  const orderedCurrent = [...current].sort((a, b) => a.sortIndex - b.sortIndex);
  const usedIncoming = new Set<number>();
  const usedCurrent = new Set<string>();
  const matched: ReconciledLine[] = [];

  const tryMatch = (line: ReconcileCurrentLine, incomingIndex: number) => {
    if (usedCurrent.has(line.id) || usedIncoming.has(incomingIndex)) return false;
    const item = incoming[incomingIndex];
    if (!item) return false;
    usedCurrent.add(line.id);
    usedIncoming.add(incomingIndex);
    matched.push(asKeep(line, incomingIndex, item));
    return true;
  };

  // Pass 1: same relative position, amount, and quantity — description-only safe.
  for (let i = 0; i < orderedCurrent.length; i += 1) {
    const line = orderedCurrent[i]!;
    const item = incoming[i];
    if (!item) continue;
    if (line.totalCents !== item.totalCents) continue;
    if (qtyOf(line.quantity) !== qtyOf(item.quantity)) continue;
    tryMatch(line, i);
  }

  // Pass 2: same position + quantity, descriptions related → price change.
  for (let i = 0; i < orderedCurrent.length; i += 1) {
    const line = orderedCurrent[i]!;
    if (usedCurrent.has(line.id)) continue;
    const item = incoming[i];
    if (!item || usedIncoming.has(i)) continue;
    if (qtyOf(line.quantity) !== qtyOf(item.quantity)) continue;
    if (!descriptionsRelated(line.displayDescription, incomingDescription(item))) {
      continue;
    }
    tryMatch(line, i);
  }

  // Pass 3: same position + amount, descriptions related → quantity change.
  for (let i = 0; i < orderedCurrent.length; i += 1) {
    const line = orderedCurrent[i]!;
    if (usedCurrent.has(line.id)) continue;
    const item = incoming[i];
    if (!item || usedIncoming.has(i)) continue;
    if (line.totalCents !== item.totalCents) continue;
    if (!descriptionsRelated(line.displayDescription, incomingDescription(item))) {
      continue;
    }
    tryMatch(line, i);
  }

  // Pass 4: unique unused (amount, qty) pair.
  for (const line of orderedCurrent) {
    if (usedCurrent.has(line.id)) continue;
    const candidates: number[] = [];
    incoming.forEach((item, index) => {
      if (usedIncoming.has(index)) return;
      if (item.totalCents === line.totalCents && qtyOf(item.quantity) === qtyOf(line.quantity)) {
        candidates.push(index);
      }
    });
    if (candidates.length === 1) tryMatch(line, candidates[0]!);
  }

  // Pass 5: unique related description among leftovers.
  for (const line of orderedCurrent) {
    if (usedCurrent.has(line.id)) continue;
    const candidates: number[] = [];
    incoming.forEach((item, index) => {
      if (usedIncoming.has(index)) return;
      if (descriptionsRelated(line.displayDescription, incomingDescription(item))) {
        candidates.push(index);
      }
    });
    if (candidates.length === 1) tryMatch(line, candidates[0]!);
  }

  for (const line of orderedCurrent) {
    if (usedCurrent.has(line.id)) continue;
    matched.push({ action: "remove", currentId: line.id, current: line });
  }
  incoming.forEach((item, index) => {
    if (usedIncoming.has(index)) return;
    matched.push({ action: "add", incomingIndex: index, incoming: item });
  });

  return matched;
}
