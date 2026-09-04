import { createHash } from "node:crypto";
import type { ParsedPasteReceipt } from "./parse";

export type PastedExtractionLine = {
  ocrText: string;
  name: string;
  quantity: number;
  unitPriceCents: number | null;
  totalPriceCents: number;
  confidence: null;
};

export type PastedExtractionPayload = {
  proposed: {
    merchant: string | null;
    purchaseDate: string | null;
    subtotalCents: number | null;
    taxCents: number | null;
    tipCents: number | null;
    feeCents: number | null;
    totalCents: number | null;
    currency: "USD";
    paymentMethodSummary: null;
    discountCents: number | null;
  };
  lineItems: PastedExtractionLine[];
  contentHash: string;
  processingMeta: {
    source: "paste";
    intake: "transcription";
    format: ParsedPasteReceipt["sourceKind"];
    ownershipHints: Array<{
      name: string;
      hint: string | null;
      membershipId: string | null;
    }>;
  };
};

export function pastedReceiptToExtraction(
  receipt: ParsedPasteReceipt,
): PastedExtractionPayload {
  const lineItems = receipt.items.map((item) => ({
    ocrText: item.raw,
    name: item.description,
    quantity: item.quantity,
    unitPriceCents: item.quantity > 1 ? Math.trunc(item.totalCents / item.quantity) : item.totalCents,
    totalPriceCents: item.totalCents,
    confidence: null,
  }));
  const proposed = {
    merchant: receipt.merchant,
    purchaseDate: receipt.purchaseDate,
    subtotalCents: receipt.subtotalCents,
    taxCents: (receipt.taxCents ?? 0) + (receipt.feeCents ?? 0) || receipt.taxCents,
    tipCents: receipt.tipCents,
    feeCents: receipt.feeCents,
    totalCents: receipt.totalCents,
    currency: "USD" as const,
    paymentMethodSummary: null,
    discountCents: receipt.discountCents,
  };
  const contentHash = createHash("sha256")
    .update(receipt.extractedBlock || receipt.originalText)
    .digest("hex");
  return {
    proposed,
    lineItems,
    contentHash,
    processingMeta: {
      source: "paste",
      intake: "transcription",
      format: receipt.sourceKind,
      ownershipHints: receipt.items.map((item) => ({
        name: item.description,
        hint: item.ownershipHint,
        membershipId: item.suggestedMembershipId,
      })),
    },
  };
}

/** Browser-safe hash when node:crypto is unavailable. */
export async function hashPastedText(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  const { createHash: nodeHash } = await import("node:crypto");
  return nodeHash("sha256").update(text).digest("hex");
}
