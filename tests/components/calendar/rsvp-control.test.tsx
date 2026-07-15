import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RsvpControl } from "@/components/calendar/RsvpControl";

vi.mock("@/app/actions/calendar", () => ({
  respondToCalendarEventAction: vi.fn(async () => ({ ok: true as const })),
}));

describe("RsvpControl", () => {
  const householdId = "11111111-1111-4111-8111-111111111111";
  const eventId = "22222222-2222-4222-8222-222222222222";

  it("renders RSVP options and defaults to Going when no prior status", () => {
    render(
      <RsvpControl
        householdId={householdId}
        eventId={eventId}
        currentStatus={null}
      />,
    );

    expect(screen.getByRole("radiogroup", { name: "RSVP status" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Going" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "Maybe" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("updates selected status when Going or Maybe is clicked", async () => {
    const user = userEvent.setup();
    render(
      <RsvpControl
        householdId={householdId}
        eventId={eventId}
        currentStatus="maybe"
        currentGuestCount={1}
      />,
    );

    const going = screen.getByRole("radio", { name: "Going" });
    const maybe = screen.getByRole("radio", { name: "Maybe" });

    expect(maybe).toHaveAttribute("aria-checked", "true");

    await user.click(going);
    expect(going).toHaveAttribute("aria-checked", "true");
    expect(maybe).toHaveAttribute("aria-checked", "false");

    await user.click(maybe);
    expect(maybe).toHaveAttribute("aria-checked", "true");
    expect(going).toHaveAttribute("aria-checked", "false");
  });

  it("hides guest count controls when Can't go is selected", async () => {
    const user = userEvent.setup();
    render(
      <RsvpControl
        householdId={householdId}
        eventId={eventId}
        currentStatus="going"
        currentGuestCount={2}
      />,
    );

    expect(
      screen.getByLabelText("Guests you're bringing"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Can't go" }));

    expect(
      screen.queryByLabelText("Guests you're bringing"),
    ).not.toBeInTheDocument();
  });
});
