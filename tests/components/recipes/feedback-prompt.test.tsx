import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecipeFeedbackPrompt } from "@/components/recipes/RecipeFeedbackPrompt";

vi.mock("@/app/actions/meals", () => ({
  submitRecipeFeedbackAction: vi.fn(async () => ({ ok: true as const })),
  dismissRecipeFeedbackAction: vi.fn(async () => ({ ok: true as const })),
}));

describe("RecipeFeedbackPrompt", () => {
  it("offers would-make-again choices, favorite toggle, and dismiss", () => {
    render(
      <RecipeFeedbackPrompt
        householdId="00000000-0000-0000-0000-000000000001"
        feedbackRequestId="00000000-0000-0000-0000-000000000002"
        recipeName="Tacos"
      />,
    );

    expect(screen.getByText(/Would you make “Tacos” again/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yes" })).toHaveAttribute(
      "value",
      "would_make_again",
    );
    expect(screen.getByRole("button", { name: "Maybe" })).toHaveAttribute(
      "value",
      "okay",
    );
    expect(screen.getByRole("button", { name: "No" })).toHaveAttribute(
      "value",
      "would_not_choose_again",
    );
    expect(screen.getByLabelText(/Mark as favorite/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Not now/i })).toBeInTheDocument();
  });

  it("can hide dismiss when allowDismiss is false", () => {
    render(
      <RecipeFeedbackPrompt
        householdId="00000000-0000-0000-0000-000000000001"
        feedbackRequestId="00000000-0000-0000-0000-000000000002"
        allowDismiss={false}
      />,
    );
    expect(screen.queryByRole("button", { name: /Not now/i })).not.toBeInTheDocument();
  });
});
