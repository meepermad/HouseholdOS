import { createHash } from "node:crypto";
import type { ExtractedReceipt } from "../types";
import type {
  ReceiptExtractionAdapter,
  ReceiptExtractionInput,
  ReceiptExtractionResult,
} from "./types";

/** Deterministic fixture adapter for tests and local demos. */
export class FixtureReceiptExtractionAdapter implements ReceiptExtractionAdapter {
  readonly name = "fixture";
  readonly configured = true;

  async extract(input: ReceiptExtractionInput): Promise<ReceiptExtractionResult> {
    const hash = createHash("sha256").update(input.bytes).digest("hex").slice(0, 32);
    const extraction: ExtractedReceipt = {
      merchant: "Fixture Market",
      purchaseDate: "2026-07-01",
      subtotalCents: 1250,
      taxCents: 100,
      tipCents: 0,
      totalCents: 1350,
      currency: "USD",
      paymentMethodSummary: "Card •••• 4242",
      lineItems: [
        {
          ocrText: "MILK 1GAL",
          name: "Milk",
          quantity: 1,
          unitPriceCents: 450,
          totalPriceCents: 450,
          confidence: 0.92,
        },
        {
          ocrText: "TRASH BAGS 30CT",
          name: "Trash bags",
          quantity: 1,
          unitPriceCents: 800,
          totalPriceCents: 800,
          confidence: 0.88,
        },
      ],
      confidence: 0.9,
      contentHash: hash,
    };
    return { ok: true, adapter: this.name, extraction };
  }
}
