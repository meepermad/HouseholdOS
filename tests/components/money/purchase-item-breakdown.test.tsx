import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PurchaseItemBreakdown } from "@/components/money/PurchaseItemBreakdown";

describe("PurchaseItemBreakdown", () => {
  it("shows merchant, items, tagged people, and shares", () => {
    render(
      <PurchaseItemBreakdown
        merchant="Target"
        items={[
          {
            id: "milk",
            name: "Milk",
            totalCents: 400,
            tagged: "Alex",
            shares: [{ membershipId: "a", name: "Alex", amountCents: 400 }],
          },
          {
            id: "bread",
            name: "Bread",
            totalCents: 600,
            tagged: "Alex and Sam",
            shares: [
              { membershipId: "a", name: "Alex", amountCents: 300 },
              { membershipId: "b", name: "Sam", amountCents: 300 },
            ],
          },
        ]}
        testId="expense-item-breakdown"
      />,
    );

    const block = screen.getByTestId("expense-item-breakdown");
    expect(block).toHaveTextContent("Target");
    expect(block).toHaveTextContent("Milk");
    expect(block).toHaveTextContent("Tagged: Alex");
    expect(block).toHaveTextContent("Tagged: Alex and Sam");
    expect(block).toHaveTextContent("Sam");
  });
});
