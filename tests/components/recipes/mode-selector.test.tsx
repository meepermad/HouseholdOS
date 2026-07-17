import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecommendationModeSelector } from "@/components/recipes/RecommendationModeSelector";

describe("RecommendationModeSelector", () => {
  it("lists all ranking modes with human labels", () => {
    render(<RecommendationModeSelector />);
    expect(screen.getByLabelText(/Ranking mode/i)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Best overall/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Use what we have/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Use food soon/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Household favorite/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Fastest/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Fewest missing items/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Meal-prep friendly/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Guest friendly/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Something different/i })).toBeInTheDocument();
  });

  it("defaults to best_overall", () => {
    render(<RecommendationModeSelector />);
    expect(screen.getByLabelText(/Ranking mode/i)).toHaveValue("best_overall");
  });
});
