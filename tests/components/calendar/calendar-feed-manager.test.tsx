import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CalendarFeedManager } from "@/components/calendar/CalendarFeedManager";

vi.mock("@/app/actions/calendar", () => ({
  createCalendarFeedAction: vi.fn(async () => ({ ok: true as const })),
  regenerateCalendarFeedAction: vi.fn(async () => ({ ok: true as const })),
  revokeCalendarFeedAction: vi.fn(async () => ({ ok: true as const })),
}));

describe("CalendarFeedManager", () => {
  const householdId = "11111111-1111-4111-8111-111111111111";

  it("renders create form labels and empty feeds message", () => {
    render(<CalendarFeedManager householdId={householdId} feeds={[]} />);

    expect(screen.getByRole("heading", { name: "Create a feed" })).toBeInTheDocument();
    expect(screen.getByLabelText("Feed name")).toBeInTheDocument();
    expect(screen.getByLabelText("Include")).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Everything I can see" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Household-visible events only" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create feed" })).toBeInTheDocument();
    expect(screen.getByText("No feeds yet.")).toBeInTheDocument();
  });

  it("shows revoke and regenerate actions for active feeds", () => {
    render(
      <CalendarFeedManager
        householdId={householdId}
        feeds={[
          {
            id: "feed-1",
            label: "Work calendar",
            scope: "household_public_only",
            createdAt: "2026-07-01T00:00:00.000Z",
            lastAccessedAt: null,
            revokedAt: null,
          },
        ]}
      />,
    );

    expect(screen.getByText("Work calendar")).toBeInTheDocument();
    expect(screen.getByText(/Household-visible events only · Active/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revoke" })).toBeInTheDocument();
  });
});
