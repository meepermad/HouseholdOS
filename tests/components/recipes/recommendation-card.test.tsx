import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecipeRecommendationCard } from "@/components/recipes/RecipeRecommendationCard";

describe("RecipeRecommendationCard", () => {
  it("renders ranking explanation and accept action", () => {
    render(
      <RecipeRecommendationCard
        householdId="00000000-0000-0000-0000-000000000001"
        mealRequestId="00000000-0000-0000-0000-000000000002"
        recipeId="00000000-0000-0000-0000-000000000003"
        name="Chicken Alfredo"
        score={42}
        reasons={["Uses spinach marked “use soon”", "Missing only Parmesan"]}
        missingRequired={1}
      />,
    );
    expect(screen.getByText("Chicken Alfredo")).toBeInTheDocument();
    expect(screen.getByText(/use soon/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Accept recipe/i })).toBeInTheDocument();
  });
});
