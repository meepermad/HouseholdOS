import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConflictWarning } from "@/components/calendar/ConflictWarning";
import { DomainSourceBadge } from "@/components/calendar/DomainSourceBadge";
import { CalendarDay } from "@/components/calendar/CalendarDay";
import type { CalendarOccurrence } from "@/lib/calendar/queries";

const baseOcc: CalendarOccurrence = {
  occurrenceId: "o1",
  eventId: "e1",
  originalStartsAt: "2026-07-01T18:00:00.000Z",
  startsAt: "2026-07-01T18:00:00.000Z",
  endsAt: "2026-07-01T19:00:00.000Z",
  allDay: false,
  startDate: null,
  endDateExclusive: null,
  title: "Dinner",
  description: null,
  location: null,
  category: "shared_meal",
  visibility: "household",
  status: "scheduled",
  timeZone: "America/Chicago",
  organizerMembershipId: "m1",
  eventGuestCount: 0,
  guestLabel: null,
  isBusyProjection: false,
  cancelled: false,
  viewerRsvp: null,
  sourceType: "meal_plan",
  calendarId: "c1",
};

describe("Phase 9 calendar components", () => {
  it("renders conflict warning with accessible label", () => {
    render(
      <ConflictWarning
        conflicts={[
          {
            eventId: "e1",
            conflictingEventId: "e2",
            resourceId: null,
            conflictClass: "possible",
            conflictKind: "participant_overlap",
            summary: "Overlaps a busy block",
          },
        ]}
      />,
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText(/Overlaps a busy block/)).toBeInTheDocument();
  });

  it("renders domain source badge", () => {
    render(<DomainSourceBadge sourceType="chore" />);
    expect(screen.getByText("Chore")).toBeInTheDocument();
  });

  it("renders day view occurrences", () => {
    render(
      <CalendarDay
        householdId="h1"
        dayKey="2026-07-01"
        heading="Wed, Jul 1"
        occurrences={[baseOcc]}
      />,
    );
    expect(screen.getByLabelText(/Day view/)).toBeInTheDocument();
    expect(screen.getByText("Dinner")).toBeInTheDocument();
    expect(screen.getByText("Meal")).toBeInTheDocument();
  });
});
