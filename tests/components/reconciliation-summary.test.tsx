import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReconciliationSummary } from "@/components/expenses/reconciliation-summary";
import type { CalculateExpenseResult } from "@/lib/expenses";

vi.mock("@/app/actions/expenses", () => ({
  upsertExpenseItemAction: vi.fn(),
  upsertExpenseAdjustmentAction: vi.fn(),
}));

const members = [
  { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", label: "Atem" },
  { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", label: "Michael" },
];

describe("ReconciliationSummary", () => {
  it("shows error state", () => {
    render(
      <ReconciliationSummary
        calc={{
          ok: false,
          code: "reconciliation_failure",
          message: "Totals do not match",
          reconciled: false,
          calculatedTotalCents: 100,
          declaredTotalCents: 120,
        }}
        members={members}
        declaredTotalCents={120}
      />,
    );
    expect(screen.getByTestId("reconciliation-error")).toHaveTextContent(
      "Totals do not match",
    );
  });

  it("shows member shares and obligations", () => {
    const calc: CalculateExpenseResult = {
      ok: true,
      reconciled: true,
      itemSubtotalCents: 1000,
      adjustmentsNetCents: 0,
      calculatedTotalCents: 1000,
      declaredTotalCents: 1000,
      lines: [],
      memberShares: [
        {
          membershipId: members[0]!.id,
          itemSubtotalCents: 500,
          adjustmentCents: 0,
          totalShareCents: 500,
          lines: [],
        },
        {
          membershipId: members[1]!.id,
          itemSubtotalCents: 500,
          adjustmentCents: 0,
          totalShareCents: 500,
          lines: [],
        },
      ],
      proportionalBasis: [],
      obligations: [
        {
          debtorMembershipId: members[1]!.id,
          creditorMembershipId: members[0]!.id,
          amountCents: 500,
          lines: [],
        },
      ],
    };
    render(
      <ReconciliationSummary calc={calc} members={members} declaredTotalCents={1000} />,
    );
    expect(screen.getByTestId("reconciliation-summary")).toHaveTextContent("Atem");
    expect(screen.getByTestId("reconciliation-summary")).toHaveTextContent(
      "Michael owes Atem",
    );
  });
});
