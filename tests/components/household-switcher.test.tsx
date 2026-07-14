import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HouseholdSwitcher } from "@/components/household-switcher";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/app/actions/household", () => ({
  switchHouseholdAction: vi.fn(),
}));

describe("HouseholdSwitcher", () => {
  it("renders authorized household options", () => {
    render(
      <HouseholdSwitcher
        householdId="11111111-1111-4111-8111-111111111111"
        households={[
          { id: "11111111-1111-4111-8111-111111111111", name: "Oak" },
          { id: "22222222-2222-4222-8222-222222222222", name: "Pine" },
        ]}
      />,
    );
    expect(screen.getByLabelText(/current household/i)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Oak" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Pine" })).toBeInTheDocument();
  });
});
