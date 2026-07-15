import { DEFAULT_TIMEZONE } from "@/lib/time";
import type { NotificationUrgency } from "@/lib/notifications/catalog";

export type QuietHoursConfig = {
  enabled: boolean;
  /** Local start time HH:MM (24h). */
  startLocal: string;
  /** Local end time HH:MM (24h). Overnight windows use start > end. */
  endLocal: string;
  timeZone: string;
  allowUrgentOverride: boolean;
};

export type LocalTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const HH_MM = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function parseHhMm(value: string): { hour: number; minute: number } | null {
  const match = HH_MM.exec(value.trim());
  if (!match) return null;
  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
  };
}

export function resolveTimeZone(timeZone: string | null | undefined): string {
  const candidate = timeZone?.trim() || DEFAULT_TIMEZONE;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: candidate });
    return candidate;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function minutesOfDay(hour: number, minute: number): number {
  return hour * 60 + minute;
}

export function getLocalParts(date: Date, timeZone: string): LocalTimeParts {
  const tz = resolveTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second ?? "0"),
  };
}

/** Convert a wall-clock local time in `timeZone` to a UTC Date. */
export function zonedLocalToUtc(
  parts: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second?: number;
  },
  timeZone: string,
): Date {
  const tz = resolveTimeZone(timeZone);
  const utcGuess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second ?? 0,
    0,
  );

  const asLocal = getLocalParts(new Date(utcGuess), tz);
  const asLocalMs = Date.UTC(
    asLocal.year,
    asLocal.month - 1,
    asLocal.day,
    asLocal.hour,
    asLocal.minute,
    asLocal.second,
  );
  const offset = asLocalMs - utcGuess;
  return new Date(utcGuess - offset);
}

export function addCalendarDays(
  year: number,
  month: number,
  day: number,
  delta: number,
): { year: number; month: number; day: number } {
  const base = new Date(Date.UTC(year, month - 1, day + delta));
  return {
    year: base.getUTCFullYear(),
    month: base.getUTCMonth() + 1,
    day: base.getUTCDate(),
  };
}

export function isWithinQuietHours(now: Date, config: QuietHoursConfig): boolean {
  if (!config.enabled) return false;

  const start = parseHhMm(config.startLocal);
  const end = parseHhMm(config.endLocal);
  if (!start || !end) return false;

  const local = getLocalParts(now, config.timeZone);
  const current = minutesOfDay(local.hour, local.minute);
  const startM = minutesOfDay(start.hour, start.minute);
  const endM = minutesOfDay(end.hour, end.minute);

  if (startM === endM) return true;

  if (startM < endM) {
    return current >= startM && current < endM;
  }

  // Overnight: e.g. 22:00 → 07:00
  return current >= startM || current < endM;
}

/**
 * Instant when delivery becomes available again (end of the current quiet
 * window). If not currently within quiet hours, returns `now`.
 */
export function nextQuietHoursEnd(now: Date, config: QuietHoursConfig): Date {
  if (!config.enabled || !isWithinQuietHours(now, config)) {
    return new Date(now.getTime());
  }

  const end = parseHhMm(config.endLocal);
  const start = parseHhMm(config.startLocal);
  if (!end || !start) return new Date(now.getTime());

  const tz = resolveTimeZone(config.timeZone);
  const local = getLocalParts(now, tz);
  const current = minutesOfDay(local.hour, local.minute);
  const startM = minutesOfDay(start.hour, start.minute);
  const endM = minutesOfDay(end.hour, end.minute);

  let day = { year: local.year, month: local.month, day: local.day };

  if (startM < endM) {
    // Same-day window; end is today.
  } else if (current >= startM) {
    // After start overnight → end is tomorrow.
    day = addCalendarDays(day.year, day.month, day.day, 1);
  }
  // else before end overnight → end is today.

  return zonedLocalToUtc(
    {
      year: day.year,
      month: day.month,
      day: day.day,
      hour: end.hour,
      minute: end.minute,
      second: 0,
    },
    tz,
  );
}

export function resolveAvailableAt(
  now: Date,
  config: QuietHoursConfig,
  urgency: NotificationUrgency,
): Date {
  const urgentOverride =
    config.allowUrgentOverride && urgency === "urgent";

  if (!config.enabled || urgentOverride || !isWithinQuietHours(now, config)) {
    return new Date(now.getTime());
  }

  return nextQuietHoursEnd(now, config);
}
