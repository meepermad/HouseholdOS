import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MealShoppingPrepReview } from "@/components/meals/MealShoppingPrepReview";

describe("MealShoppingPrepReview", () => {
  it("shows text status labels for prep lines", () => {
    render(
      <MealShoppingPrepReview
        householdId="00000000-0000-0000-0000-000000000001"
        proposalId="00000000-0000-0000-0000-000000000002"
        policy="suggest_and_confirm"
        lines={[
          {
            id: "l1",
            display_name: "Parmesan",
            line_status: "missing",
            shortfall_quantity: "1",
            quantity_unit: "item",
            excluded: false,
          },
          {
            id: "l2",
            display_name: "Salt",
            line_status: "optional",
            shortfall_quantity: null,
            quantity_unit: "teaspoon",
            excluded: true,
          },
        ]}
      />,
    );
    expect(screen.getByText(/Missing/)).toBeInTheDocument();
    expect(screen.getByText(/Optional/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirm proposed additions/i })).toBeInTheDocument();
  });
});
