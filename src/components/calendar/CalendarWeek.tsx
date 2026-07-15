import Link from "next/link";
import { CalendarEventCard } from "@/components/calendar/CalendarEventCard";
import {
  formatShortDay,
  occurrenceDayKey,
  todayKeyInTz,
} from "@/lib/calendar/display";
import { DEFAULT_TIMEZONE } from "@/lib/time";
import type { CalendarOccurrence } from "@/lib/calendar/queries";

/** Simple 7-column week view for large screens. */
export function CalendarWeek({
  householdId,
  weekDayKeys,
  occurrences,
  timeZone = DEFAULT_TIMEZONE,
}: {
  householdId: string;
  weekDayKeys: string[];
  occurrences: CalendarOccurrence[];
  timeZone?: string;
}) {
  const byDay = new Map<string, CalendarOccurrence[]>();
  for (const occ of occurrences) {
    const key = occurrenceDayKey(occ);
    const list = byDay.get(key) ?? [];
    list.push(occ);
    byDay.set(key, list);
  }
  const today = todayKeyInTz(timeZone);

  return (
    <div className="grid grid-cols-7 gap-2">
      {weekDayKeys.map((dayKey) => {
        const events = byDay.get(dayKey) ?? [];
        const isToday = dayKey === today;
        return (
          <div key={dayKey} className="flex min-h-40 flex-col gap-2">
            <Link
              href={`/app/${householdId}/calendar?view=agenda&date=${dayKey}`}
              className={`rounded-md px-2 py-1 text-center text-xs font-medium ${
                isToday
                  ? "bg-primary text-primary-foreground"
                  : "text-text-secondary hover:bg-surface-interactive"
              }`}
            >
              {formatShortDay(dayKey)}
            </Link>
            <div className="flex flex-col gap-1.5">
              {events.length === 0 ? (
                <p className="px-1 text-xs text-text-muted">—</p>
              ) : (
                events.map((occ) => (
                  <CalendarEventCard
                    key={occ.occurrenceId}
                    householdId={householdId}
                    occurrence={occ}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
