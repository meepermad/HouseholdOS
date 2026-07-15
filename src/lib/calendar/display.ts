import { DEFAULT_TIMEZONE } from "@/lib/time";
import type { CalendarOccurrence } from "@/lib/calendar/queries";

/** YYYY-MM-DD for an instant in a timezone (stable day-bucket key). */
export function dayKeyInTz(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** The day bucket for an occurrence (all-day events use their start date). */
export function occurrenceDayKey(occ: CalendarOccurrence): string {
  if (occ.allDay && occ.startDate) return occ.startDate;
  return dayKeyInTz(occ.startsAt, occ.timeZone || DEFAULT_TIMEZONE);
}

export function formatDayHeading(dayKey: string): string {
  // dayKey is a floating calendar date; render it without timezone shift.
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatShortDay(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatOccurrenceTimeRange(occ: CalendarOccurrence): string {
  if (occ.allDay) return "All day";
  const tz = occ.timeZone || DEFAULT_TIMEZONE;
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  });
  return `${fmt.format(new Date(occ.startsAt))} – ${fmt.format(new Date(occ.endsAt))}`;
}

export function formatEventDateTime(
  iso: string,
  timeZone: string,
  allDay: boolean,
): string {
  if (allDay) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone || DEFAULT_TIMEZONE,
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
}

export type OccurrenceDayGroup = {
  dayKey: string;
  allDay: CalendarOccurrence[];
  timed: CalendarOccurrence[];
};

/** Group occurrences by day bucket, splitting all-day from timed. */
export function groupOccurrencesByDay(
  occurrences: readonly CalendarOccurrence[],
): OccurrenceDayGroup[] {
  const map = new Map<string, OccurrenceDayGroup>();
  for (const occ of occurrences) {
    const key = occurrenceDayKey(occ);
    let group = map.get(key);
    if (!group) {
      group = { dayKey: key, allDay: [], timed: [] };
      map.set(key, group);
    }
    if (occ.allDay) group.allDay.push(occ);
    else group.timed.push(occ);
  }
  return Array.from(map.values()).sort((a, b) =>
    a.dayKey.localeCompare(b.dayKey),
  );
}

/** Local-day range [start, end) in ISO for a month grid built around `anchor`. */
export function monthGridRange(anchorDayKey: string): {
  gridStart: string;
  gridEnd: string;
  monthStartKey: string;
  monthEndKey: string;
  weeks: string[][];
} {
  const [y, m] = anchorDayKey.split("-").map(Number);
  const year = y ?? 1970;
  const month = (m ?? 1) - 1;
  const first = new Date(Date.UTC(year, month, 1));
  const last = new Date(Date.UTC(year, month + 1, 0));
  // Start grid on Sunday of the first week.
  const gridStartDate = new Date(first);
  gridStartDate.setUTCDate(first.getUTCDate() - first.getUTCDay());
  const gridEndDate = new Date(last);
  gridEndDate.setUTCDate(last.getUTCDate() + (6 - last.getUTCDay()));

  const weeks: string[][] = [];
  let cursor = new Date(gridStartDate);
  while (cursor <= gridEndDate) {
    const week: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      week.push(cursor.toISOString().slice(0, 10));
      cursor = new Date(cursor);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  }

  return {
    gridStart: `${gridStartDate.toISOString().slice(0, 10)}T00:00:00.000Z`,
    gridEnd: `${new Date(gridEndDate.getTime() + 86_400_000)
      .toISOString()
      .slice(0, 10)}T00:00:00.000Z`,
    monthStartKey: first.toISOString().slice(0, 10),
    monthEndKey: last.toISOString().slice(0, 10),
    weeks,
  };
}

export function todayKeyInTz(timeZone: string = DEFAULT_TIMEZONE): string {
  return dayKeyInTz(new Date().toISOString(), timeZone);
}
