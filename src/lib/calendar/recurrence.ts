import { RRule, RRuleSet, rrulestr, Frequency, Weekday } from "rrule";
import {
  getZonedParts,
  zonedWallClockToUtc,
} from "@/lib/calendar/time-mode";

export type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "yearly";

export type RecurrenceEnd =
  | { type: "never" }
  | { type: "until"; untilDate: string } // YYYY-MM-DD in event TZ (inclusive last day)
  | { type: "count"; count: number };

export type RecurrenceInput =
  | { frequency: "none" }
  | {
      frequency: RecurrenceFrequency;
      interval?: number;
      byWeekday?: Array<"MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU">;
      /** e.g. 1 = first, -1 = last (monthly with byWeekday) */
      bySetPos?: number[];
      /** Day of month 1–31 or -1 for last day */
      byMonthDay?: number[];
      end?: RecurrenceEnd;
    }
  | { frequency: "custom"; rrule: string };

export const OCCURRENCE_HORIZON_PAST_DAYS = 90;
export const OCCURRENCE_HORIZON_FUTURE_DAYS = 180;

const WEEKDAY_MAP: Record<string, Weekday> = {
  MO: RRule.MO,
  TU: RRule.TU,
  WE: RRule.WE,
  TH: RRule.TH,
  FR: RRule.FR,
  SA: RRule.SA,
  SU: RRule.SU,
};

export function buildRruleString(
  input: RecurrenceInput,
  seedStartsAt: Date,
  timeZone: string,
): string | null {
  if (input.frequency === "none") return null;
  if (input.frequency === "custom") {
    // Validate by parsing
    rrulestr(normalizeRrule(input.rrule), { forceset: true });
    return normalizeRrule(input.rrule);
  }

  const parts = getZonedParts(seedStartsAt, timeZone);
  const dtstart = zonedWallClockToUtc(parts, timeZone);

  const freq =
    input.frequency === "daily"
      ? Frequency.DAILY
      : input.frequency === "weekly"
        ? Frequency.WEEKLY
        : input.frequency === "monthly"
          ? Frequency.MONTHLY
          : Frequency.YEARLY;

  const options: Partial<ConstructorParameters<typeof RRule>[0]> = {
    freq,
    interval: Math.max(1, input.interval ?? 1),
    dtstart,
  };

  if (input.byWeekday?.length) {
    options.byweekday = input.byWeekday.map((d) => WEEKDAY_MAP[d]!);
  }
  if (input.bySetPos?.length) {
    options.bysetpos = input.bySetPos;
  }
  if (input.byMonthDay?.length) {
    options.bymonthday = input.byMonthDay;
  }

  const end = input.end ?? { type: "never" as const };
  if (end.type === "count") {
    options.count = Math.min(Math.max(1, end.count), 520);
  } else if (end.type === "until") {
    options.until = zonedWallClockToUtc(
      {
        year: Number(end.untilDate.slice(0, 4)),
        month: Number(end.untilDate.slice(5, 7)),
        day: Number(end.untilDate.slice(8, 10)),
        hour: 23,
        minute: 59,
        second: 59,
      },
      timeZone,
    );
  }

  const rule = new RRule(options as ConstructorParameters<typeof RRule>[0]);
  // Strip DTSTART from toString — we store dtstart on the event row.
  return rule.toString().replace(/^DTSTART[^\n]*\n?/m, "");
}

function normalizeRrule(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.toUpperCase().startsWith("RRULE:")) return trimmed;
  return `RRULE:${trimmed}`;
}

/** Parse stored RRULE body with explicit dtstart (open-ended rules need non-forceset parse). */
function parseRecurrenceRule(rrule: string, dtstart: Date): RRuleSet | RRule {
  const body = normalizeRrule(rrule).replace(/^RRULE:/i, "");
  return rrulestr(body, { dtstart });
}

export type OccurrenceCandidate = {
  /** Original recurrence instance start (UTC ISO) — stable key for exceptions */
  originalStartsAt: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  startDate: string | null;
  endDateExclusive: string | null;
};

export type ExceptionOverlay = {
  originalStartsAt: string;
  kind: "cancelled" | "override";
  startsAt?: string | null;
  endsAt?: string | null;
  startDate?: string | null;
  endDateExclusive?: string | null;
  allDay?: boolean | null;
  /** Metadata overrides — null/undefined means inherit from master */
  title?: string | null;
  description?: string | null;
  location?: string | null;
  eventGuestCount?: number | null;
  guestLabel?: string | null;
  overridesAttendees?: boolean;
  overridesReminders?: boolean;
};

function addDaysIso(dateIso: string, days: number): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + days));
  return dt.toISOString().slice(0, 10);
}

function durationMs(startsAt: Date, endsAt: Date): number {
  return endsAt.getTime() - startsAt.getTime();
}

/**
 * Deterministic bounded occurrence expansion for a master event.
 */
export function expandOccurrences(params: {
  allDay: boolean;
  startsAt: Date | string | null;
  endsAt: Date | string | null;
  startDate: string | null;
  endDateExclusive: string | null;
  timeZone: string;
  rrule: string | null;
  rangeStart: Date;
  rangeEnd: Date;
  exceptions?: readonly ExceptionOverlay[];
}): OccurrenceCandidate[] {
  const tz = params.timeZone;
  const exceptions = params.exceptions ?? [];
  const cancelled = new Set(
    exceptions.filter((e) => e.kind === "cancelled").map((e) => e.originalStartsAt),
  );
  const overrides = new Map(
    exceptions
      .filter((e) => e.kind === "override")
      .map((e) => [e.originalStartsAt, e] as const),
  );

  if (!params.rrule) {
    // Single occurrence
    if (params.allDay) {
      if (!params.startDate || !params.endDateExclusive) return [];
      const startMs = Date.parse(`${params.startDate}T00:00:00Z`);
      if (startMs > params.rangeEnd.getTime()) return [];
      if (Date.parse(`${params.endDateExclusive}T00:00:00Z`) < params.rangeStart.getTime()) {
        return [];
      }
      const original = `${params.startDate}T00:00:00.000Z`;
      if (cancelled.has(original)) return [];
      const ov = overrides.get(original);
      return [
        {
          originalStartsAt: original,
          startsAt: ov?.startsAt ?? `${params.startDate}T00:00:00.000Z`,
          endsAt: ov?.endsAt ?? `${params.endDateExclusive}T00:00:00.000Z`,
          allDay: ov?.allDay ?? true,
          startDate: ov?.startDate ?? params.startDate,
          endDateExclusive: ov?.endDateExclusive ?? params.endDateExclusive,
        },
      ];
    }
    if (!params.startsAt || !params.endsAt) return [];
    const start = typeof params.startsAt === "string" ? new Date(params.startsAt) : params.startsAt;
    const end = typeof params.endsAt === "string" ? new Date(params.endsAt) : params.endsAt;
    if (end < params.rangeStart || start > params.rangeEnd) return [];
    const original = start.toISOString();
    if (cancelled.has(original)) return [];
    const ov = overrides.get(original);
    return [
      {
        originalStartsAt: original,
        startsAt: ov?.startsAt ?? start.toISOString(),
        endsAt: ov?.endsAt ?? end.toISOString(),
        allDay: false,
        startDate: null,
        endDateExclusive: null,
      },
    ];
  }

  const results: OccurrenceCandidate[] = [];

  if (params.allDay && params.startDate && params.endDateExclusive) {
    const daySpan =
      (Date.parse(`${params.endDateExclusive}T00:00:00Z`) -
        Date.parse(`${params.startDate}T00:00:00Z`)) /
      86_400_000;
    const seed = zonedWallClockToUtc(
      {
        year: Number(params.startDate.slice(0, 4)),
        month: Number(params.startDate.slice(5, 7)),
        day: Number(params.startDate.slice(8, 10)),
        hour: 12,
        minute: 0,
        second: 0,
      },
      tz,
    );
    const set = parseRecurrenceRule(params.rrule, seed);
    const dates = set.between(params.rangeStart, params.rangeEnd, true);
    for (const d of dates) {
      const local = getZonedParts(d, tz);
      const startDate = `${local.year}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`;
      const endDateExclusive = addDaysIso(startDate, daySpan);
      const original = `${startDate}T00:00:00.000Z`;
      if (cancelled.has(original)) continue;
      const ov = overrides.get(original);
      results.push({
        originalStartsAt: original,
        startsAt: ov?.startsAt ?? `${startDate}T00:00:00.000Z`,
        endsAt: ov?.endsAt ?? `${endDateExclusive}T00:00:00.000Z`,
        allDay: ov?.allDay ?? true,
        startDate: ov?.startDate ?? startDate,
        endDateExclusive: ov?.endDateExclusive ?? endDateExclusive,
      });
    }
    return results;
  }

  if (!params.startsAt || !params.endsAt) return [];
  const masterStart =
    typeof params.startsAt === "string" ? new Date(params.startsAt) : params.startsAt;
  const masterEnd =
    typeof params.endsAt === "string" ? new Date(params.endsAt) : params.endsAt;
  const dur = durationMs(masterStart, masterEnd);
  const wall = getZonedParts(masterStart, tz);
  const seed = zonedWallClockToUtc(wall, tz);

  const set = parseRecurrenceRule(params.rrule, seed);

  // Expand slightly wider, then remap each to wall-clock in TZ (DST safe).
  const dates = set.between(
    new Date(params.rangeStart.getTime() - 2 * 86_400_000),
    new Date(params.rangeEnd.getTime() + 2 * 86_400_000),
    true,
  );

  for (const d of dates) {
    const p = getZonedParts(d, tz);
    // Force master wall-clock time onto each occurrence date (DST-preserving).
    const starts = zonedWallClockToUtc(
      {
        year: p.year,
        month: p.month,
        day: p.day,
        hour: wall.hour,
        minute: wall.minute,
        second: wall.second,
      },
      tz,
    );
    if (starts < params.rangeStart || starts > params.rangeEnd) continue;
    const ends = new Date(starts.getTime() + dur);
    const original = starts.toISOString();
    if (cancelled.has(original)) continue;
    const ov = overrides.get(original);
    results.push({
      originalStartsAt: original,
      startsAt: ov?.startsAt ?? starts.toISOString(),
      endsAt: ov?.endsAt ?? ends.toISOString(),
      allDay: false,
      startDate: null,
      endDateExclusive: null,
    });
  }

  return results;
}

export function defaultHorizon(now = new Date()): { rangeStart: Date; rangeEnd: Date } {
  return {
    rangeStart: new Date(
      now.getTime() - OCCURRENCE_HORIZON_PAST_DAYS * 86_400_000,
    ),
    rangeEnd: new Date(
      now.getTime() + OCCURRENCE_HORIZON_FUTURE_DAYS * 86_400_000,
    ),
  };
}

export function summarizeRrule(rrule: string | null): string {
  if (!rrule) return "Does not repeat";
  try {
    const rule = rrulestr(normalizeRrule(rrule));
    if (rule instanceof RRule) return rule.toText();
    return "Custom recurrence";
  } catch {
    return "Custom recurrence";
  }
}

/** Preset builders for the UI */
export function weekdayRrule(): RecurrenceInput {
  return {
    frequency: "weekly",
    byWeekday: ["MO", "TU", "WE", "TH", "FR"],
  };
}

export function biweeklyRrule(): RecurrenceInput {
  return { frequency: "weekly", interval: 2 };
}

export function firstSaturdayMonthly(): RecurrenceInput {
  return { frequency: "monthly", byWeekday: ["SA"], bySetPos: [1] };
}

export function lastDayOfMonth(): RecurrenceInput {
  return { frequency: "monthly", byMonthDay: [-1] };
}
