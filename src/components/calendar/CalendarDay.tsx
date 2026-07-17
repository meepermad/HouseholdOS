"use client";

import { CalendarEventCard } from "@/components/calendar/CalendarEventCard";
import { DomainSourceBadge } from "@/components/calendar/DomainSourceBadge";
import type { CalendarOccurrence } from "@/lib/calendar/queries";
import Link from "next/link";

export function CalendarDay({
  householdId,
  dayKey,
  heading,
  occurrences,
}: {
  householdId: string;
  dayKey: string;
  heading: string;
  occurrences: CalendarOccurrence[];
}) {
  const sorted = [...occurrences].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );

  return (
    <section aria-label={`Day view for ${heading}`} className="space-y-3">
      <p className="text-sm text-text-secondary">{heading}</p>
      {sorted.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-text-secondary">
          No events on this day.{" "}
          <Link
            href={`/app/${householdId}/calendar/new?date=${dayKey}`}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Create one
          </Link>
        </p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((occ) => (
            <li key={occ.occurrenceId} className="space-y-1">
              {occ.sourceType ? (
                <DomainSourceBadge sourceType={occ.sourceType} />
              ) : null}
              <CalendarEventCard householdId={householdId} occurrence={occ} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
