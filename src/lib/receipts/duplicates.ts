import type { DuplicateOutcome } from "./types";

export type DuplicateCandidate = {
  id: string;
  fileHash: string | null;
  perceptualHash: string | null;
  merchant: string | null;
  purchaseDate: string | null;
  totalCents: number | null;
  contentHash: string | null;
  expenseId: string | null;
};

export type DuplicateSignal = {
  kind:
    | "file_hash"
    | "perceptual_hash"
    | "merchant_date_total"
    | "content_hash"
    | "existing_expense";
  matchedId: string;
};

export type DuplicateDetectionResult = {
  outcome: DuplicateOutcome;
  signals: DuplicateSignal[];
  matchReceiptId: string | null;
  matchExpenseId: string | null;
};

function normMerchant(value: string | null): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Hamming distance for equal-length hex perceptual hashes. */
export function hammingDistanceHex(a: string, b: string): number | null {
  if (!a || !b || a.length !== b.length) return null;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    const x = parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16);
    dist += x.toString(2).split("1").length - 1;
  }
  return dist;
}

/**
 * Detect likely duplicate receipts. Never merges or deletes — advisory only.
 */
export function detectDuplicateReceipts(
  candidate: DuplicateCandidate,
  existing: DuplicateCandidate[],
): DuplicateDetectionResult {
  const signals: DuplicateSignal[] = [];
  let matchReceiptId: string | null = null;
  let matchExpenseId: string | null = null;
  let exact = false;
  let possible = false;

  for (const other of existing) {
    if (other.id === candidate.id) continue;

    if (
      candidate.fileHash &&
      other.fileHash &&
      candidate.fileHash === other.fileHash
    ) {
      signals.push({ kind: "file_hash", matchedId: other.id });
      matchReceiptId = other.id;
      exact = true;
      if (other.expenseId) {
        matchExpenseId = other.expenseId;
        signals.push({ kind: "existing_expense", matchedId: other.expenseId });
      }
    }

    if (
      candidate.perceptualHash &&
      other.perceptualHash
    ) {
      const dist = hammingDistanceHex(
        candidate.perceptualHash,
        other.perceptualHash,
      );
      if (dist !== null && dist <= 5) {
        signals.push({ kind: "perceptual_hash", matchedId: other.id });
        matchReceiptId = matchReceiptId ?? other.id;
        if (dist === 0) exact = true;
        else possible = true;
      }
    }

    if (
      candidate.contentHash &&
      other.contentHash &&
      candidate.contentHash === other.contentHash
    ) {
      signals.push({ kind: "content_hash", matchedId: other.id });
      matchReceiptId = matchReceiptId ?? other.id;
      exact = true;
    }

    const sameMerchant =
      normMerchant(candidate.merchant) !== "" &&
      normMerchant(candidate.merchant) === normMerchant(other.merchant);
    const sameDate =
      candidate.purchaseDate &&
      other.purchaseDate &&
      candidate.purchaseDate === other.purchaseDate;
    const sameTotal =
      candidate.totalCents !== null &&
      other.totalCents !== null &&
      candidate.totalCents === other.totalCents;

    if (sameMerchant && sameDate && sameTotal) {
      signals.push({ kind: "merchant_date_total", matchedId: other.id });
      matchReceiptId = matchReceiptId ?? other.id;
      possible = true;
      if (other.expenseId) {
        matchExpenseId = other.expenseId;
        signals.push({ kind: "existing_expense", matchedId: other.expenseId });
      }
    }
  }

  let outcome: DuplicateOutcome = "none";
  if (exact) outcome = "exact";
  else if (matchExpenseId) outcome = "existing_expense";
  else if (possible || signals.length > 0) outcome = "possible";

  return { outcome, signals, matchReceiptId, matchExpenseId };
}
