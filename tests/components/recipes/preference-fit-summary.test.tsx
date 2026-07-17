import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PreferenceFitSummary } from "@/components/recipes/PreferenceFitSummary";

describe("PreferenceFitSummary", () => {
  it("labels known fit values", () => {
    render(<PreferenceFitSummary fit="strong" />);
    expect(screen.getByText("Strong fit")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute(
      "aria-label",
      "Strong fit",
    );
  });

  it("falls back to unknown for missing or invalid values", () => {
    const { rerender } = render(<PreferenceFitSummary fit={null} />);
    expect(screen.getByText("Preference fit unknown")).toBeInTheDocument();

    rerender(<PreferenceFitSummary fit="not-a-real-fit" />);
    expect(screen.getByText("Preference fit unknown")).toBeInTheDocument();
  });
});
