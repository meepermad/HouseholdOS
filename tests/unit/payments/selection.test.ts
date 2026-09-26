import { describe, expect, it } from "vitest";
import {
  allocationsForSelection,
  filterExpenses,
  pageExpenses,
  selectIds,
  selectionCountLabel,
  summarizeSelection,
  type SettlementExpense,
} from "@/lib/payments/selection";

const H = "hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh";
const DEBTOR = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const CREDITOR = "cccccccc-cccc-cccc-cccc-cccccccccccc";

function expense(partial: Partial<SettlementExpense> & { id: string }): SettlementExpense {
  return {
    label: partial.label ?? partial.id,
    householdId: H,
    debtorMembershipId: DEBTOR,
    creditorMembershipId: CREDITOR,
    currency: "USD",
    effectiveAmountCents: 1000,
    officialOutstandingCents: 1000,
    pendingPaymentCents: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    eligible: true,
    ...partial,
  };
}

describe("settlement selection", () => {
  const expenses = [
    expense({ id: "a", label: "Walmart", officialOutstandingCents: 2850, effectiveAmountCents: 2850, createdAt: "2026-01-01T00:00:00.000Z" }),
    expense({ id: "b", label: "Electricity", officialOutstandingCents: 3500, effectiveAmountCents: 3500, createdAt: "2026-01-02T00:00:00.000Z" }),
    expense({ id: "c", label: "Supplies", officialOutstandingCents: 1275, effectiveAmountCents: 1275, createdAt: "2026-01-03T00:00:00.000Z" }),
  ];

  it("selects every displayed expense and names the count", () => {
    const selected = selectIds(new Set(), expenses.map((row) => row.id));
    const summary = summarizeSelection(selected, expenses, "sent");
    expect(summary.count).toBe(3);
    expect(summary.totalCents).toBe(2850 + 3500 + 1275);
    expect(selectionCountLabel(summary.count)).toBe("3 expenses selected");
    expect(summary.attention).toEqual([]);
  });

  it("builds allocations from the selected ids, including a partial amount", () => {
    const lines = allocationsForSelection({
      expenses,
      selectedIds: new Set(["a", "b", "c"]),
      direction: "sent",
      amountCents: 3000,
      viewerMembershipId: DEBTOR,
      counterpartyMembershipId: CREDITOR,
      householdId: H,
      currency: "USD",
    });
    expect(lines.map((line) => line.obligationId)).toEqual(["a", "b"]);
    expect(lines.reduce((sum, line) => sum + line.amountCents, 0)).toBe(3000);
  });

  it("names an expense that became ineligible instead of a generic selection error", () => {
    const rows = [
      expenses[0]!,
      expense({
        id: "b",
        label: "Electricity",
        eligible: false,
        ineligibleReason: "It has already been settled.",
      }),
    ];
    const summary = summarizeSelection(new Set(["a", "b"]), rows, "sent");
    expect(summary.count).toBe(1);
    expect(summary.attention[0]).toMatchObject({
      label: "Electricity",
      reason: "It has already been settled.",
    });
  });

  it("filters without dropping ids that are not shown", () => {
    const filtered = filterExpenses(expenses, "elect");
    expect(filtered.map((row) => row.id)).toEqual(["b"]);
    const selected = selectIds(new Set(["a"]), filtered.map((row) => row.id));
    expect([...selected].sort()).toEqual(["a", "b"]);
  });

  it("pages the picker", () => {
    const page = pageExpenses(expenses, 0, 2);
    expect(page.rows).toHaveLength(2);
    expect(page.pageCount).toBe(2);
  });
});
