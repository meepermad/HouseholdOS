import Link from "next/link";
import {
  CALENDAR_CATEGORY_LABELS,
  CALENDAR_CATEGORY_MARKS,
} from "@/lib/calendar/categories";
import { formatOccurrenceTimeRange } from "@/lib/calendar/display";
import type { CalendarOccurrence } from "@/lib/calendar/queries";

export function CalendarEventCard({
  householdId,
  occurrence,
  showTime = true,
}: {
  householdId: string;
  occurrence: CalendarOccurrence;
  showTime?: boolean;
}) {
  const { cancelled, isBusyProjection } = occurrence;

  const containerClass = cancelled
    ? "border-border bg-surface-secondary opacity-70"
    : isBusyProjection
      ? "border-dashed border-border-strong bg-surface-secondary"
      : "border-border bg-surface hover:bg-surface-interactive";

  return (
    <Link
      href={`/app/${householdId}/calendar/event/${occurrence.eventId}?originalStartsAt=${encodeURIComponent(occurrence.originalStartsAt)}`}
      className={`flex items-start gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors ${containerClass}`}
      aria-label={`${occurrence.title}${cancelled ? " (cancelled)" : ""}`}
    >
      <span
        aria-hidden
        className="mt-0.5 w-4 shrink-0 text-center text-text-muted"
        title={CALENDAR_CATEGORY_LABELS[occurrence.category]}
      >
        {isBusyProjection ? "•" : CALENDAR_CATEGORY_MARKS[occurrence.category]}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate font-medium ${
            cancelled ? "text-text-muted line-through" : "text-text-primary"
          }`}
        >
          {occurrence.title}
        </span>
        {showTime ? (
          <span className="mt-0.5 block text-xs tabular-nums text-text-secondary">
            {formatOccurrenceTimeRange(occurrence)}
            {occurrence.location && !isBusyProjection ? (
              <span className="text-text-muted"> · {occurrence.location}</span>
            ) : null}
          </span>
        ) : null}
        {cancelled ? (
          <span className="mt-0.5 block text-xs font-medium text-text-muted">
            Cancelled
          </span>
        ) : null}
      </span>
    </Link>
  );
}
