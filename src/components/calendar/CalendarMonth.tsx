import Link from "next/link";
import {
  monthGridRange,
  occurrenceDayKey,
  todayKeyInTz,
} from "@/lib/calendar/display";
import { DEFAULT_TIMEZONE } from "@/lib/time";
import type { CalendarOccurrence } from "@/lib/calendar/queries";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarMonth({
  householdId,
  anchorDayKey,
  occurrences,
  timeZone = DEFAULT_TIMEZONE,
}: {
  householdId: string;
  anchorDayKey: string;
  occurrences: CalendarOccurrence[];
  timeZone?: string;
}) {
  const { weeks, monthStartKey } = monthGridRange(anchorDayKey);
  const anchorMonth = monthStartKey.slice(0, 7);
  const today = todayKeyInTz(timeZone);

  const byDay = new Map<string, CalendarOccurrence[]>();
  for (const occ of occurrences) {
    const key = occurrenceDayKey(occ);
    const list = byDay.get(key) ?? [];
    list.push(occ);
    byDay.set(key, list);
  }

  function dayHref(dayKey: string): string {
    return `/app/${householdId}/calendar?view=agenda&date=${dayKey}`;
  }

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-1 pb-1 text-center text-xs font-medium uppercase tracking-wide text-text-muted"
            aria-hidden
          >
            {label}
          </div>
        ))}
      </div>
      <div
        className="grid grid-cols-7 gap-1"
        role="grid"
        aria-label="Month calendar"
      >
        {weeks.flat().map((dayKey) => {
          const inMonth = dayKey.slice(0, 7) === anchorMonth;
          const dayNum = Number(dayKey.slice(8, 10));
          const events = byDay.get(dayKey) ?? [];
          const isToday = dayKey === today;
          const visible = events.slice(0, 3);
          const overflow = events.length - visible.length;

          return (
            <Link
              key={dayKey}
              href={dayHref(dayKey)}
              role="gridcell"
              aria-label={`${dayKey}${events.length ? `, ${events.length} events` : ", no events"}`}
              className={`flex min-h-20 flex-col gap-1 rounded-md border p-1.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${
                inMonth
                  ? "border-border bg-surface hover:bg-surface-interactive"
                  : "border-transparent bg-surface-secondary text-text-muted hover:bg-surface-interactive"
              }`}
            >
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums ${
                  isToday
                    ? "bg-primary font-semibold text-primary-foreground"
                    : inMonth
                      ? "text-text-primary"
                      : "text-text-muted"
                }`}
              >
                {dayNum}
              </span>
              <span className="flex flex-col gap-0.5">
                {visible.map((occ) => (
                  <span
                    key={occ.occurrenceId}
                    className={`truncate rounded px-1 py-0.5 text-[0.65rem] leading-tight ${
                      occ.cancelled
                        ? "text-text-muted line-through"
                        : "bg-surface-interactive text-text-secondary"
                    }`}
                  >
                    {occ.title}
                  </span>
                ))}
                {overflow > 0 ? (
                  <span className="px-1 text-[0.65rem] text-text-muted">
                    +{overflow} more
                  </span>
                ) : null}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
