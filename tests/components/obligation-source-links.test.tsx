import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ObligationSourceLinks } from "@/components/payments/ObligationSourceLinks";

describe("ObligationSourceLinks", () => {
  it("links to the receipt and expense that created the balance", () => {
    render(
      <ObligationSourceLinks
        householdId="hh"
        source={{
          expenseId: "e1",
          receiptId: "r1",
          merchant: "Trader Joe's",
          purchaseDate: "2026-03-04",
          kind: "reimbursement",
        }}
      />,
    );
    expect(screen.getByTestId("obligation-source")).toHaveTextContent("Trader Joe's");
    expect(screen.getByRole("link", { name: "Receipt" })).toHaveAttribute(
      "href",
      "/app/hh/money/receipts/r1",
    );
    expect(screen.getByRole("link", { name: "Expense" })).toHaveAttribute(
      "href",
      "/app/hh/money/expenses/e1",
    );
  });
});
