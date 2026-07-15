import { DEFAULT_TIMEZONE } from "@/lib/time";

export type TimedEventInput = {
  allDay: false;
  startsAt: Date | string;
  endsAt: Date | string;
  timeZone: string;
  startDate?: never;
  endDateExclusive?: never;
};

export type AllDayEventInput = {
  allDay: true;
  startDate: string;
  endDateExclusive: string;
  timeZone?: string;
  startsAt?: never;
  endsAt?: never;
};

export type CalendarTimeInput = TimedEventInput | AllDayEventInput;

export type TimeValidationResult =
  | { ok: true; mode: "timed" | "all_day"; timeZone: string }
  | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIanaTimeZone(tz: string): boolean {
  if (!tz || typeof tz !== "string") return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function toDate(value: Date | string): Date {
  return typeof value === "string" ? new Date(value) : value;
}

/**
 * Validate that an event is either timed XOR all-day — never a mixed invalid state.
 */
export function validateEventTimeMode(input: {
  allDay: boolean;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
  startDate?: string | null;
  endDateExclusive?: string | null;
  timeZone?: string | null;
}): TimeValidationResult {
  const timeZone = (input.timeZone?.trim() || DEFAULT_TIMEZONE).trim();
  if (!isValidIanaTimeZone(timeZone)) {
    return { ok: false, error: "Invalid timezone." };
  }

  if (input.allDay) {
    if (input.startsAt != null || input.endsAt != null) {
      return { ok: false, error: "All-day events cannot include timed timestamps." };
    }
    const startDate = input.startDate?.trim() ?? "";
    const endDateExclusive = input.endDateExclusive?.trim() ?? "";
    if (!DATE_RE.test(startDate) || !DATE_RE.test(endDateExclusive)) {
      return { ok: false, error: "All-day events require valid start and exclusive end dates." };
    }
    if (endDateExclusive <= startDate) {
      return {
        ok: false,
        error: "All-day exclusive end date must be after the start date.",
      };
    }
    return { ok: true, mode: "all_day", timeZone };
  }

  if (input.startDate != null || input.endDateExclusive != null) {
    return { ok: false, error: "Timed events cannot include all-day date fields." };
  }
  if (input.startsAt == null || input.endsAt == null) {
    return { ok: false, error: "Timed events require start and end timestamps." };
  }
  const startsAt = toDate(input.startsAt);
  const endsAt = toDate(input.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return { ok: false, error: "Invalid event timestamps." };
  }
  if (endsAt.getTime() <= startsAt.getTime()) {
    return { ok: false, error: "Event end must be after start." };
  }
  return { ok: true, mode: "timed", timeZone };
}

/** Format wall-clock parts in a timezone (for DST-safe recurrence seeding). */
export function getZonedParts(
  instant: Date,
  timeZone: string,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);

  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/**
 * Build a UTC Date that represents the given local wall-clock in `timeZone`.
 * Used so recurrence preserves local time across DST.
 */
export function zonedWallClockToUtc(
  parts: {
    year: number;
    month: number;
    day: number;
    hour?: number;
    minute?: number;
    second?: number;
  },
  timeZone: string,
): Date {
  const hour = parts.hour ?? 0;
  const minute = parts.minute ?? 0;
  const second = parts.second ?? 0;
  const probe = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute, second));
  const asLocal = getZonedParts(probe, timeZone);
  const desiredAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute, second);
  const actualAsUtc = Date.UTC(
    asLocal.year,
    asLocal.month - 1,
    asLocal.day,
    asLocal.hour,
    asLocal.minute,
    asLocal.second,
  );
  return new Date(probe.getTime() + (desiredAsUtc - actualAsUtc));
}
