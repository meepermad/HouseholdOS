import { describe, expect, it } from "vitest";
import {
  expensesListHref,
  monthBounds,
  parseExpenseListFilters,
  parsePaymentListFilters,
  serializeExpenseListFilters,
  shiftMonth,
} from "@/lib/money/list-filters";

describe("list-filters", () => {
  it("parses and serializes expense filters", () => {
    const parsed = parseExpenseListFilters({
      status: "confirmed",
      month: "2026-07",
      merchant: "Costco",
      hasReceipt: "yes",
      disputed: "no",
      pendingConfirmation: "yes",
    });
    expect(parsed.month).toBe("2026-07");
    expect(serializeExpenseListFilters(parsed)).toContain("merchant=Costco");
    expect(expensesListHref("hh", parsed)).toContain("/money/expenses?");
  });

  it("rejects invalid month", () => {
    expect(parseExpenseListFilters({ month: "07-2026" }).month).toBeUndefined();
  });

  it("computes month bounds and shift", () => {
    expect(monthBounds("2026-07")).toEqual({
      from: "2026-07-01",
      toExclusive: "2026-08-01",
    });
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("parses payment pending confirmation", () => {
    const p = parsePaymentListFilters({ pendingConfirmation: "yes", minCents: "100" });
    expect(p.pendingConfirmation).toBe("yes");
    expect(p.minCents).toBe(100);
  });
});
