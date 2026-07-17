import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CalendarAgenda } from "@/components/calendar/CalendarAgenda";
import { BUSY_BLOCK_TITLE } from "@/lib/calendar/visibility";
import type { CalendarOccurrence } from "@/lib/calendar/queries";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function makeOccurrence(
  overrides: Partial<CalendarOccurrence> = {},
): CalendarOccurrence {
  return {
    occurrenceId: "occ-1",
    eventId: "evt-1",
    originalStartsAt: "2026-07-16T14:00:00.000Z",
    startsAt: "2026-07-16T14:00:00.000Z",
    endsAt: "2026-07-16T15:00:00.000Z",
    allDay: false,
    startDate: null,
    endDateExclusive: null,
    title: "House meeting",
    description: null,
    location: "Living room",
    category: "household_meeting",
    visibility: "household",
    status: "confirmed",
    timeZone: "UTC",
    organizerMembershipId: "mem-1",
    eventGuestCount: null,
    guestLabel: null,
    isBusyProjection: false,
    cancelled: false,
    viewerRsvp: null,
    sourceType: null,
    calendarId: null,
    ...overrides,
  };
}

describe("CalendarAgenda", () => {
  const householdId = "11111111-1111-4111-8111-111111111111";

  it("renders all-day and timed events including busy projections", () => {
    render(
      <CalendarAgenda
        householdId={householdId}
        canCreate
        timeZone="UTC"
        occurrences={[
          makeOccurrence({
            occurrenceId: "occ-all-day",
            eventId: "evt-all-day",
            title: "Move-out day",
            allDay: true,
            startDate: "2026-07-16",
            endDateExclusive: "2026-07-17",
            startsAt: "2026-07-16T00:00:00.000Z",
            endsAt: "2026-07-17T00:00:00.000Z",
          }),
          makeOccurrence({
            occurrenceId: "occ-timed",
            eventId: "evt-timed",
            title: "Shared dinner",
            startsAt: "2026-07-16T18:00:00.000Z",
            endsAt: "2026-07-16T20:00:00.000Z",
            category: "shared_meal",
          }),
          makeOccurrence({
            occurrenceId: "occ-busy",
            eventId: "evt-busy",
            title: BUSY_BLOCK_TITLE,
            isBusyProjection: true,
            visibility: "private_busy",
            location: null,
            startsAt: "2026-07-16T12:00:00.000Z",
            endsAt: "2026-07-16T13:00:00.000Z",
          }),
        ]}
      />,
    );

    expect(screen.getByText("All day")).toBeInTheDocument();
    expect(screen.getByLabelText("Move-out day")).toBeInTheDocument();
    expect(screen.getByLabelText("Shared dinner")).toBeInTheDocument();
    expect(screen.getByLabelText(BUSY_BLOCK_TITLE)).toBeInTheDocument();
  });

  it("shows empty state when there are no occurrences", () => {
    render(
      <CalendarAgenda
        householdId={householdId}
        canCreate={false}
        occurrences={[]}
      />,
    );

    expect(screen.getByTestId("empty-calendar")).toBeInTheDocument();
    expect(screen.getByText("No events yet")).toBeInTheDocument();
  });
});
