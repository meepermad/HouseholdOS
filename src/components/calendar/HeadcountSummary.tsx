import { computeHeadcount } from "@/lib/calendar/headcount";
import type { CalendarAttendee } from "@/lib/calendar/queries";

export function HeadcountSummary({
  attendees,
  eventGuestCount = 0,
  guestLabel,
}: {
  attendees: CalendarAttendee[];
  eventGuestCount?: number;
  guestLabel?: string | null;
}) {
  const summary = computeHeadcount(
    attendees.map((a) => ({
      rsvpStatus: a.rsvpStatus,
      guestCount: a.guestCount,
    })),
    eventGuestCount,
  );

  const stats: { label: string; value: number }[] = [
    { label: "Going", value: summary.goingRoommates },
    { label: "Maybe", value: summary.maybeRoommates },
    { label: "Can't go", value: summary.notGoingRoommates },
    { label: "No reply", value: summary.needsActionRoommates },
  ];

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-md border border-border bg-surface p-3 text-center"
          >
            <dt className="text-xs text-text-muted">{s.label}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-text-primary">
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-text-secondary">
        Expected headcount:{" "}
        <span className="font-semibold tabular-nums text-text-primary">
          {summary.expectedConfirmedHeadcount}
        </span>{" "}
        confirmed
        {summary.possibleMaximumHeadcount !== summary.expectedConfirmedHeadcount ? (
          <>
            {" "}· up to{" "}
            <span className="font-semibold tabular-nums text-text-primary">
              {summary.possibleMaximumHeadcount}
            </span>{" "}
            possible
          </>
        ) : null}
        {summary.confirmedGuests > 0 ? (
          <>
            {" "}(includes {summary.confirmedGuests}{" "}
            {guestLabel?.trim() ? guestLabel : "guests"})
          </>
        ) : null}
      </p>
    </div>
  );
}
