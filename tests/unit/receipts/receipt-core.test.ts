import { describe, expect, it } from "vitest";
import { parseCurrencyAmountToCents } from "@/lib/receipts/currency";
import { reconcileLineItemsWithTotal } from "@/lib/receipts/totals";
import { detectDuplicateReceipts } from "@/lib/receipts/duplicates";
import { projectOcrConfidence, confidenceLabel } from "@/lib/receipts/confidence";
import { classificationToAllocationMode } from "@/lib/receipts/classification";
import { suggestResourceDestination } from "@/lib/receipts/resource-suggestions";
import { maskPaymentInfo, containsFullCardNumber } from "@/lib/receipts/mask-payment";
import { FixtureReceiptExtractionAdapter } from "@/lib/receipts/adapters/fixture";
import { DisabledReceiptExtractionAdapter } from "@/lib/receipts/adapters/disabled";

describe("receipt currency parsing", () => {
  it("parses USD strings to cents", () => {
    expect(parseCurrencyAmountToCents("$12.34")).toBe(1234);
    expect(parseCurrencyAmountToCents("1,234.56")).toBe(123456);
    expect(parseCurrencyAmountToCents("(3.50)")).toBe(-350);
  });
});

describe("receipt totals reconciliation", () => {
  it("balances subtotal + tax + tip", () => {
    const result = reconcileLineItemsWithTotal({
      lineItems: [
        { totalPriceCents: 1000, quantity: 1, unitPriceCents: 1000 },
        { totalPriceCents: 250, quantity: 1, unitPriceCents: 250 },
      ],
      subtotalCents: 1250,
      taxCents: 100,
      tipCents: 0,
      totalCents: 1350,
    });
    expect(result.balanced).toBe(true);
    expect(result.lineSumCents).toBe(1250);
  });

  it("flags mismatched totals", () => {
    const result = reconcileLineItemsWithTotal({
      lineItems: [{ totalPriceCents: 500, quantity: null, unitPriceCents: null }],
      subtotalCents: 500,
      taxCents: 0,
      tipCents: 0,
      totalCents: 999,
    });
    expect(result.balanced).toBe(false);
  });
});

describe("duplicate detection", () => {
  it("detects exact file hash duplicates", () => {
    const result = detectDuplicateReceipts(
      {
        id: "a",
        fileHash: "abc",
        perceptualHash: null,
        merchant: null,
        purchaseDate: null,
        totalCents: null,
        contentHash: null,
        expenseId: null,
      },
      [
        {
          id: "b",
          fileHash: "abc",
          perceptualHash: null,
          merchant: null,
          purchaseDate: null,
          totalCents: null,
          contentHash: null,
          expenseId: "exp1",
        },
      ],
    );
    expect(result.outcome).toBe("exact");
    expect(result.matchExpenseId).toBe("exp1");
  });

  it("detects possible merchant/date/total matches", () => {
    const result = detectDuplicateReceipts(
      {
        id: "a",
        fileHash: "1",
        perceptualHash: null,
        merchant: "Store",
        purchaseDate: "2026-01-01",
        totalCents: 500,
        contentHash: null,
        expenseId: null,
      },
      [
        {
          id: "b",
          fileHash: "2",
          perceptualHash: null,
          merchant: "store",
          purchaseDate: "2026-01-01",
          totalCents: 500,
          contentHash: null,
          expenseId: null,
        },
      ],
    );
    expect(result.outcome).toBe("possible");
  });
});

describe("ocr confidence", () => {
  it("projects percent and fraction values", () => {
    expect(projectOcrConfidence(0.9)).toBe(0.9);
    expect(projectOcrConfidence(90)).toBe(0.9);
    expect(confidenceLabel(0.9)).toBe("Looks clear");
  });
});

describe("classification", () => {
  it("maps to allocation modes without inferring payer ownership alone", () => {
    expect(classificationToAllocationMode("shared_household")).toBe("equal_all");
    expect(classificationToAllocationMode("personal_purchaser")).toBe("personal");
    expect(classificationToAllocationMode("excluded")).toBe("excluded");
  });
});

describe("resource suggestions", () => {
  it("suggests pantry and supply destinations", () => {
    expect(suggestResourceDestination("Organic milk").destination).toBe(
      "pantry_restock",
    );
    expect(suggestResourceDestination("Trash bags 30ct").destination).toBe(
      "supply_restock",
    );
    expect(suggestResourceDestination("Air fryer").destination).toBe(
      "inventory_add",
    );
  });
});

describe("payment masking", () => {
  it("masks card numbers", () => {
    const masked = maskPaymentInfo("Paid with 4111111111111111");
    expect(masked).toContain("•••• 1111");
    expect(containsFullCardNumber("4111111111111111")).toBe(true);
  });
});

describe("ocr adapters", () => {
  it("fixture returns extraction", async () => {
    const adapter = new FixtureReceiptExtractionAdapter();
    const result = await adapter.extract({
      mimeType: "image/jpeg",
      fileName: "r.jpg",
      bytes: new Uint8Array([1, 2, 3]),
      householdId: "h",
      receiptId: "r",
    });
    expect(result.ok).toBe(true);
  });

  it("disabled does not claim OCR success", async () => {
    const adapter = new DisabledReceiptExtractionAdapter();
    const result = await adapter.extract({
      mimeType: "image/jpeg",
      fileName: "r.jpg",
      bytes: new Uint8Array([1]),
      householdId: "h",
      receiptId: "r",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.configured).toBe(false);
  });
});
