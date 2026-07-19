import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecommendationItemActions } from "@/components/shopping/RecommendationActions";
import { RediscoveryActions } from "@/components/shopping/RediscoveryActions";
import { RediscoveryIngredientReview } from "@/components/shopping/RediscoveryIngredientReview";
import { TripControls } from "@/components/shopping/TripControls";

vi.mock("@/app/actions/shopping-intel", () => ({
  addRecommendedItemAction: vi.fn(async () => ({ ok: true })),
  dismissRecommendedItemAction: vi.fn(async () => ({ ok: true })),
  generateShoppingRecommendationsAction: vi.fn(async () => ({ ok: true })),
  decideRediscoveryAction: vi.fn(async () => ({ ok: true })),
  confirmRediscoveryIngredientsAction: vi.fn(async () => ({ ok: true })),
  startShoppingTripAction: vi.fn(async () => ({ ok: true })),
  completeShoppingTripAction: vi.fn(async () => ({ ok: true })),
  markTripItemUnavailableAction: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/components/action-form", () => ({
  ActionForm: ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => (
    <form {...props}>{children}</form>
  ),
}));

describe("Shopping Intelligence components", () => {
  it("renders recommendation quantity editor and dismiss actions", () => {
    render(
      <RecommendationItemActions
        householdId="h1"
        itemId="i1"
        suggestedQuantity={2}
        suggestedUnit="item"
      />,
    );
    expect(screen.getByLabelText(/Suggested quantity/i)).toHaveValue(2);
    expect(screen.getByTestId("add-recommendation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Not this trip/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Remind next trip/i })).toBeInTheDocument();
  });

  it("shows Forgotten Favorite actions with household label and review link", () => {
    render(
      <RediscoveryActions
        householdId="h1"
        suggestionId="s1"
        recipeId="r1"
        householdName="Oak House"
      />,
    );
    expect(screen.getByTestId("household-context-label")).toHaveTextContent(
      "Oak House",
    );
    expect(screen.getByTestId("add-missing-ingredients")).toHaveAttribute(
      "href",
      "/app/h1/house/recipes/rediscover/s1/ingredients",
    );
    expect(screen.getByTestId("plan-rediscovered-meal")).toBeInTheDocument();
    expect(screen.getByTestId("rediscovery-recently_had")).toBeInTheDocument();
    expect(screen.getByTestId("rediscovery-suppress")).toBeInTheDocument();
  });

  it("renders missing-ingredient proposal with unit mismatch and qty controls", () => {
    render(
      <RediscoveryIngredientReview
        householdId="h1"
        proposalId="p1"
        householdName="Oak House"
        recipeName="Chicken Alfredo"
        lines={[
          {
            id: "l1",
            displayName: "Parmesan",
            lineStatus: "missing",
            shortfallQuantity: 1,
            quantityUnit: "item",
            excluded: false,
            unitMismatch: false,
            required: true,
          },
          {
            id: "l2",
            displayName: "Cream",
            lineStatus: "needs_unit_review",
            shortfallQuantity: null,
            quantityUnit: "cup",
            excluded: true,
            unitMismatch: true,
            required: true,
          },
        ]}
      />,
    );
    expect(screen.getByTestId("rediscovery-ingredient-review")).toBeInTheDocument();
    expect(screen.getByText(/unit needs review/i)).toBeInTheDocument();
    expect(screen.getByTestId("confirm-rediscovery-ingredients")).toBeInTheDocument();
    expect(screen.getAllByTestId("ingredient-qty")).toHaveLength(2);
  });

  it("renders trip start and unavailable controls", () => {
    const { rerender } = render(
      <TripControls householdId="h1" listId="list1" tripId={null} />,
    );
    expect(screen.getByTestId("start-shopping-trip")).toBeInTheDocument();
    rerender(
      <TripControls
        householdId="h1"
        listId="list1"
        tripId="trip1"
        markUnavailableItemId="item1"
      />,
    );
    expect(
      screen.getByRole("button", { name: /Mark unavailable/i }),
    ).toBeInTheDocument();
  });
});
