import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HeadcountSummary } from "@/components/calendar/HeadcountSummary";
import type { CalendarAttendee } from "@/lib/calendar/queries";

function makeAttendee(
  overrides: Partial<CalendarAttendee> = {},
): CalendarAttendee {
  return {
    membershipId: "mem-1",
    userId: "user-1",
    label: "Alex",
    participationRole: "attendee",
    rsvpStatus: "going",
    guestCount: 0,
    guestNote: null,
    ...overrides,
  };
}

describe("HeadcountSummary", () => {
  it("renders RSVP breakdown and expected headcount from sample attendees", () => {
    render(
      <HeadcountSummary
        attendees={[
          makeAttendee({ label: "Alex", rsvpStatus: "going", guestCount: 2 }),
          makeAttendee({
            membershipId: "mem-2",
            label: "Jordan",
            rsvpStatus: "maybe",
            guestCount: 1,
          }),
          makeAttendee({
            membershipId: "mem-3",
            label: "Sam",
            rsvpStatus: "not_going",
            guestCount: 0,
          }),
          makeAttendee({
            membershipId: "mem-4",
            label: "Riley",
            rsvpStatus: "needs_action",
            guestCount: 0,
          }),
        ]}
        eventGuestCount={1}
        guestLabel="plus ones"
      />,
    );

    expect(screen.getByText("Going")).toBeInTheDocument();
    expect(screen.getByText("Maybe")).toBeInTheDocument();
    expect(screen.getByText("Can't go")).toBeInTheDocument();
    expect(screen.getByText("No reply")).toBeInTheDocument();

    const goingCell = screen.getByText("Going").closest("div");
    expect(goingCell?.querySelector("dd")).toHaveTextContent("1");
    expect(screen.getByText(/Expected headcount:/)).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText(/includes 3 plus ones/)).toBeInTheDocument();
  });
});
