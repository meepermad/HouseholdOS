import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ImportReviewForm } from "@/components/recipes/import/ImportReviewForm";
import { RecipeImportForm } from "@/components/recipes/import/RecipeImportForm";

vi.mock("@/app/actions/recipe-import", () => ({
  requestRecipeImportAction: vi.fn(async () => ({ ok: true })),
  saveImportedRecipeAction: vi.fn(async () => ({ ok: true })),
}));

const HOUSEHOLD = "00000000-0000-4000-8000-0000000000aa";
const DRAFT = "00000000-0000-4000-8000-0000000000bb";

describe("RecipeImportForm", () => {
  it("renders URL field and import CTA", () => {
    render(<RecipeImportForm householdId={HOUSEHOLD} />);

    expect(screen.getByText("Recipe URL")).toBeInTheDocument();
    const url = screen.getByPlaceholderText("https://example.com/recipe");
    expect(url).toHaveAttribute("name", "sourceUrl");
    expect(url).toHaveAttribute("type", "url");
    expect(url).toBeRequired();
    expect(
      screen.getByRole("button", { name: /Import for review/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/will not sign in, bypass a paywall/i),
    ).toBeInTheDocument();
  });
});

describe("ImportReviewForm", () => {
  it("shows warnings and duplicate panel", () => {
    render(
      <ImportReviewForm
        householdId={HOUSEHOLD}
        draftId={DRAFT}
        sourceHostname="fixtures.example"
        warnings={[
          "Found 2 recipe candidates — select one to continue",
          "Some ingredients need review",
        ]}
        duplicate={{ id: "00000000-0000-4000-8000-0000000000cc", name: "Prior Lemon Pasta" }}
        initialRecipe={{
          name: "Fixture Lemon Pasta",
          category: "pasta",
          cuisine: "Italian",
          baseServings: 4,
          yieldText: "4 servings",
          prepMinutes: 15,
          cookMinutes: 20,
          totalMinutes: 35,
          ingredients: [
            {
              originalText: "1 1/2 cups flour",
              display_name: "flour",
              quantity: "1.5",
              quantity_unit: "cup",
              quantity_mode: "exact",
              required: true,
            },
          ],
          steps: [
            {
              step_number: 1,
              instruction: "Boil the pasta until al dente.",
              section: "Pasta",
              phase: "cooking",
            },
          ],
        }}
      />,
    );

    expect(
      screen.getByText(/Review required · imported from fixtures.example/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Found 2 recipe candidates/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Some ingredients need review/i),
    ).toBeInTheDocument();

    expect(screen.getByText("Exact source already imported")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Open Prior Lemon Pasta/i }),
    ).toHaveAttribute(
      "href",
      `/app/${HOUSEHOLD}/recipes/00000000-0000-4000-8000-0000000000cc`,
    );
    expect(screen.getByLabelText(/Import as a separate copy/i)).toBeInTheDocument();

    expect(screen.getByDisplayValue("Fixture Lemon Pasta")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save recipe/i })).toBeInTheDocument();
  });
});
