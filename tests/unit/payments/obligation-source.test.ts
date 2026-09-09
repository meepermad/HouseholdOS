import { describe, expect, it } from "vitest";
import {
  obligationPurchaseLabel,
  sourceFromMaps,
} from "@/lib/payments/obligation-source";

describe("obligation purchase source", () => {
  it("labels a receipt-backed purchase with merchant and date", () => {
    expect(
      obligationPurchaseLabel({
        expenseId: "e1",
        receiptId: "r1",
        merchant: "Trader Joe's",
        purchaseDate: "2026-03-04",
        kind: "reimbursement",
      }),
    ).toMatch(/^Trader Joe's · Mar 4/);
  });

  it("labels refunds and starting balances", () => {
    expect(
      obligationPurchaseLabel({
        expenseId: "e1",
        receiptId: null,
        merchant: "ALDI",
        purchaseDate: "2026-03-12",
        kind: "refund",
      }),
    ).toMatch(/^Refund from ALDI · Mar 12/);
    expect(
      obligationPurchaseLabel({
        expenseId: null,
        receiptId: null,
        merchant: "",
        purchaseDate: null,
        kind: "opening_balance",
      }),
    ).toBe("Starting balance");
  });

  it("resolves a mapped expense and receipt", () => {
    const sources = new Map([
      ["e1", { merchant: "ALDI", purchaseDate: "2026-03-12", receiptId: "r9" }],
    ]);
    expect(sourceFromMaps("e1", "reimbursement", sources)).toEqual({
      expenseId: "e1",
      receiptId: "r9",
      merchant: "ALDI",
      purchaseDate: "2026-03-12",
      kind: "reimbursement",
    });
  });
});
