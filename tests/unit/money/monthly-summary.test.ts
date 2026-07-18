import { describe, expect, it } from "vitest";
import { computeMonthlyFinancialSummary } from "@/lib/money/monthly-summary";

describe("computeMonthlyFinancialSummary", () => {
  it("keeps pending and confirmed separate", () => {
    const summary = computeMonthlyFinancialSummary({
      householdId: "hh",
      membershipId: "m1",
      month: "2026-07",
      expenses: [
        {
          id: "e1",
          merchant: "Store",
          category: "groceries",
          purchase_date: "2026-07-10",
          declared_total_cents: 10000,
          status: "confirmed",
          my_share_cents: 2500,
        },
        {
          id: "e2",
          merchant: "Draft",
          category: "other",
          purchase_date: "2026-07-12",
          declared_total_cents: 4000,
          status: "draft",
        },
      ],
      payments: [
        {
          id: "p1",
          total_amount_cents: 2000,
          status: "confirmed",
          submitted_at: "2026-07-01T00:00:00Z",
          confirmed_at: "2026-07-02T00:00:00Z",
        },
        {
          id: "p2",
          total_amount_cents: 1500,
          status: "submitted",
          submitted_at: "2026-07-05T00:00:00Z",
          confirmed_at: null,
        },
      ],
      utilities: [{ estimated_amount_cents: 5000, actual_amount_cents: 5200 }],
      priorMonthExpenses: [
        {
          id: "e0",
          merchant: "Prior",
          category: "groceries",
          purchase_date: "2026-06-10",
          declared_total_cents: 8000,
          status: "confirmed",
        },
      ],
    });

    expect(summary.sharedPurchasesConfirmedCents).toBe(10000);
    expect(summary.sharedPurchasesPendingCents).toBe(4000);
    expect(summary.yourAllocatedShareCents).toBe(2500);
    expect(summary.confirmedReimbursementsCents).toBe(2000);
    expect(summary.pendingPaymentConfirmationCents).toBe(1500);
    expect(summary.recurringBillsCents).toBe(5200);
    expect(summary.hasUsefulData).toBe(true);
    expect(summary.categories[0]?.category).toBe("groceries");
    expect(summary.priorSharedPurchasesConfirmedCents).toBe(8000);
    expect(summary.deepLinks.sharedPurchases).toContain("month=2026-07");
  });

  it("hides when insufficient data", () => {
    const summary = computeMonthlyFinancialSummary({
      householdId: "hh",
      membershipId: "m1",
      month: "2026-07",
      expenses: [],
      payments: [],
    });
    expect(summary.hasUsefulData).toBe(false);
  });
});
