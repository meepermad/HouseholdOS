import { describe, expect, it } from "vitest";
import {
  buildMoneyCreateActions,
  isMoneyCreateEmpty,
} from "@/lib/money/create-actions";

const base = {
  householdId: "hh1",
  activeMemberCount: 3,
  receiptsEnabled: true,
  canCreateExpense: true,
  canCreatePayment: true,
  sharedPurchaseEnabled: true,
};

describe("buildMoneyCreateActions", () => {
  it("offers the three everyday ways to add money records", () => {
    const groups = buildMoneyCreateActions(base);
    expect(groups.primary.map((a) => a.key)).toEqual([
      "scan_receipt",
      "add_expense",
      "record_payment",
    ]);
  });

  it("keeps rarer entry points in the more group", () => {
    const groups = buildMoneyCreateActions(base);
    expect(groups.more.map((a) => a.key)).toEqual([
      "opening_balance",
      "shared_purchase",
    ]);
  });

  it("omits receipt scanning when receipt capture is not ready", () => {
    const groups = buildMoneyCreateActions({ ...base, receiptsEnabled: false });
    expect(groups.primary.map((a) => a.key)).toEqual([
      "add_expense",
      "record_payment",
    ]);
  });

  it("omits expense entry points without expense.create", () => {
    const groups = buildMoneyCreateActions({
      ...base,
      canCreateExpense: false,
    });
    expect(groups.primary.map((a) => a.key)).toEqual(["record_payment"]);
  });

  it("omits payments and shared purchases for single-member households", () => {
    const groups = buildMoneyCreateActions({
      ...base,
      activeMemberCount: 1,
    });
    expect(groups.primary.map((a) => a.key)).toEqual([
      "scan_receipt",
      "add_expense",
    ]);
    expect(groups.more.map((a) => a.key)).toEqual(["opening_balance"]);
  });

  it("hides reimbursement until a create route exists", () => {
    const groups = buildMoneyCreateActions(base);
    expect(groups.more.some((a) => a.key === "reimbursement")).toBe(false);
    const enabled = buildMoneyCreateActions({
      ...base,
      reimbursementCreateEnabled: true,
    });
    expect(enabled.more.some((a) => a.key === "reimbursement")).toBe(true);
  });

  it("never lists browsing surfaces", () => {
    const groups = buildMoneyCreateActions(base);
    const hrefs = [...groups.primary, ...groups.more].map((a) => a.href);
    expect(hrefs.some((h) => h.endsWith("/ledger"))).toBe(false);
    expect(hrefs.some((h) => h.endsWith("/balances"))).toBe(false);
    expect(hrefs.some((h) => h.endsWith("/settings"))).toBe(false);
  });

  it("reports an empty sheet when no permission allows creating anything", () => {
    const groups = buildMoneyCreateActions({
      ...base,
      canCreateExpense: false,
      canCreatePayment: false,
      sharedPurchaseEnabled: false,
    });
    expect(isMoneyCreateEmpty(groups)).toBe(true);
  });
});
