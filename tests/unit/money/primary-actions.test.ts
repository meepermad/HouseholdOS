import { describe, expect, it } from "vitest";
import { selectPrimaryActions } from "@/lib/money/primary-actions";

const base = {
  householdId: "hh1",
  activeMemberCount: 4,
  receiptsEnabled: true,
  canCreateExpense: true,
  canCreatePayment: true,
  paymentConfirmCount: 0,
  firstConfirmPaymentId: null as string | null,
  officialYouOweCents: 0,
  receiptDraftCount: 0,
};

describe("selectPrimaryActions", () => {
  it("defaults to scan receipt and add expense", () => {
    const actions = selectPrimaryActions(base);
    expect(actions.map((a) => a.key)).toEqual(["scan_receipt", "add_expense"]);
  });

  it("prioritizes payment confirmation", () => {
    const actions = selectPrimaryActions({
      ...base,
      paymentConfirmCount: 2,
      firstConfirmPaymentId: "pay1",
      officialYouOweCents: 5000,
      receiptDraftCount: 3,
    });
    expect(actions[0]?.key).toBe("confirm_payment");
    expect(actions).toHaveLength(2);
  });

  it("prioritizes record payment when user owes", () => {
    const actions = selectPrimaryActions({
      ...base,
      officialYouOweCents: 2410,
    });
    expect(actions.map((a) => a.key)).toEqual(["record_payment", "scan_receipt"]);
  });

  it("prioritizes receipt review when drafts exist", () => {
    const actions = selectPrimaryActions({
      ...base,
      receiptDraftCount: 2,
    });
    expect(actions.map((a) => a.key)).toEqual(["review_receipts", "add_expense"]);
    expect(actions[0]?.label).toBe("Review 2 receipts");
  });

  it("hides record payment for single-member households", () => {
    const actions = selectPrimaryActions({
      ...base,
      activeMemberCount: 1,
      officialYouOweCents: 1000,
    });
    expect(actions.map((a) => a.key)).toEqual(["scan_receipt", "add_expense"]);
  });
});
