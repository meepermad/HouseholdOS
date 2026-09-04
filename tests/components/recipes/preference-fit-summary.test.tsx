import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PreferenceFitSummary } from "@/components/recipes/PreferenceFitSummary";

describe("PreferenceFitSummary", () => {
  it("labels known fit values", () => {
    render(<PreferenceFitSummary fit="strong" />);
    expect(screen.getByText("Usually a good match")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute(
      "aria-label",
      "Usually a good match",
    );
  });

  it("falls back to unknown for missing or invalid values", () => {
    const { rerender } = render(<PreferenceFitSummary fit={null} />);
    expect(screen.getByText("Not sure how this fits yet")).toBeInTheDocument();

    rerender(<PreferenceFitSummary fit="not-a-real-fit" />);
    expect(screen.getByText("Not sure how this fits yet")).toBeInTheDocument();
  });
});
