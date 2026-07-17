import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SetupWizard } from "@/components/setup/SetupWizard";

vi.mock("@/app/actions/setup", () => ({
  updateSetupStepAction: vi.fn(async () => ({ ok: true, message: "saved" })),
  completeSetupAction: vi.fn(async () => ({ ok: true })),
  applyResponsibilityTemplatesAction: vi.fn(async () => ({ ok: true })),
  applySupplyTemplatesAction: vi.fn(async () => ({ ok: true })),
}));

describe("SetupWizard", () => {
  it("renders progress and allows skipping", async () => {
    const user = userEvent.setup();
    render(
      <SetupWizard
        householdId="hh"
        initial={{
          steps: {},
          dismissedAt: null,
          completedAt: null,
          currentStep: "basics",
        }}
      />,
    );
    expect(screen.getByTestId("setup-wizard")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Household basics/i })).toBeInTheDocument();
    await user.click(screen.getByTestId("setup-skip-step"));
  });
});
