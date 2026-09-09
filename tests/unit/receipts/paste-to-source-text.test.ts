import { describe, expect, it } from "vitest";
import { householdOsPasteFromStoredReceipt, preferExistingPasteText } from "@/lib/receipts/paste/to-source-text";

describe("householdOsPasteFromStoredReceipt", () => {
  it("rebuilds a HouseholdOS block from stored lines", () => {
    const text = householdOsPasteFromStoredReceipt({
      merchant: "ALDI",
      purchaseDate: "2026-08-20",
      totalCents: 1299,
      taxCents: 99,
      items: [
        {
          description: "Milk",
          sourceText: "Milk | 12.00 | 1",
          totalCents: 1200,
          quantity: 1,
        },
      ],
    });
    expect(text).toContain("HOUSEHOLDOS RECEIPT");
    expect(text).toContain("Merchant: ALDI");
    expect(text).toContain("Milk | 12.00 | 1");
    expect(text).toContain("END");
  });

  it("prefers an existing pasted transcription over a rebuild", () => {
    expect(
      preferExistingPasteText([
        "HOUSEHOLDOS RECEIPT\nMerchant: Walmart\nEND",
        "rebuild",
      ]),
    ).toMatch(/Walmart/);
  });
});
