import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmptyState } from "@/components/ui/empty-state";
import { DisclosureSection } from "@/components/ui/disclosure-section";
import { RotationPreview } from "@/components/chores/RotationPreview";

describe("UX primitives", () => {
  it("renders compact section empty state", () => {
    render(
      <EmptyState
        variant="section"
        title="Nothing here"
        description="Try again later"
        testId="empty-section"
      />,
    );
    expect(screen.getByTestId("empty-section")).toHaveTextContent(
      "Nothing here",
    );
  });

  it("keeps disclosure children in the document when collapsed", async () => {
    const user = userEvent.setup();
    render(
      <DisclosureSection title="Advanced options" testId="disc">
        <input name="secret" defaultValue="kept" aria-label="Secret" />
      </DisclosureSection>,
    );
    expect(screen.getByLabelText("Secret")).toBeInTheDocument();
    expect(screen.getByLabelText("Secret")).not.toBeVisible();
    await user.click(screen.getByRole("button", { name: /Advanced options/i }));
    expect(screen.getByLabelText("Secret")).toBeVisible();
  });

  it("warns when round robin has fewer than two members", () => {
    render(
      <RotationPreview
        strategy="round_robin"
        members={[{ id: "m1", label: "Alex" }]}
      />,
    );
    expect(
      screen.getByTestId("rotation-single-member-warning"),
    ).toBeInTheDocument();
  });
});
