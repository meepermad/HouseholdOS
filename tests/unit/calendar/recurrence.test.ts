import { describe, expect, it } from "vitest";
import {
  OCCURRENCE_HORIZON_FUTURE_DAYS,
  OCCURRENCE_HORIZON_PAST_DAYS,
  biweeklyRrule,
  buildRruleString,
  defaultHorizon,
  expandOccurrences,
  firstSaturdayMonthly,
  lastDayOfMonth,
  weekdayRrule,
} from "@/lib/calendar/recurrence";
import { getZonedParts, zonedWallClockToUtc } from "@/lib/calendar/time-mode";

const TZ = "America/Chicago";

function weeklyAtNineAmChicago(seedLocal: {
  year: number;
  month: number;
  day: number;
}): { startsAt: Date; endsAt: Date; rrule: string } {
  const startsAt = zonedWallClockToUtc({ ...seedLocal, hour: 9, minute: 0, second: 0 }, TZ);
  const endsAt = new Date(startsAt.getTime() + 60 * 60_000);
  const rrule =
    buildRruleString({ frequency: "weekly", byWeekday: ["SU"] }, startsAt, TZ) ?? "";
  return { startsAt, endsAt, rrule };
}

describe("buildRruleString", () => {
  it("builds daily recurrence", () => {
    const seed = zonedWallClockToUtc({ year: 2026, month: 1, day: 1, hour: 10 }, TZ);
    const rrule = buildRruleString({ frequency: "daily" }, seed, TZ);
    expect(rrule).toMatch(/FREQ=DAILY/);
    expect(rrule).not.toMatch(/^DTSTART/);
  });

  it("builds weekly recurrence on weekdays", () => {
    const seed = zonedWallClockToUtc({ year: 2026, month: 1, day: 5, hour: 9 }, TZ);
    const rrule = buildRruleString(weekdayRrule(), seed, TZ);
    expect(rrule).toMatch(/FREQ=WEEKLY/);
    expect(rrule).toMatch(/BYDAY=MO,TU,WE,TH,FR/);
  });

  it("builds biweekly recurrence", () => {
    const seed = zonedWallClockToUtc({ year: 2026, month: 1, day: 5, hour: 9 }, TZ);
    const rrule = buildRruleString(biweeklyRrule(), seed, TZ);
    expect(rrule).toMatch(/FREQ=WEEKLY/);
    expect(rrule).toMatch(/INTERVAL=2/);
  });

  it("builds monthly recurrence presets", () => {
    const seed = zonedWallClockToUtc({ year: 2026, month: 1, day: 3, hour: 9 }, TZ);
    const firstSat = buildRruleString(firstSaturdayMonthly(), seed, TZ);
    expect(firstSat).toMatch(/FREQ=MONTHLY/);
    expect(firstSat).toMatch(/BYDAY=SA/);
    expect(firstSat).toMatch(/BYSETPOS=1/);

    const lastDay = buildRruleString(lastDayOfMonth(), seed, TZ);
    expect(lastDay).toMatch(/FREQ=MONTHLY/);
    expect(lastDay).toMatch(/BYMONTHDAY=-1/);
  });

  it("applies recurrence end date (UNTIL)", () => {
    const seed = zonedWallClockToUtc({ year: 2026, month: 1, day: 1, hour: 9 }, TZ);
    const rrule = buildRruleString(
      { frequency: "daily", end: { type: "until", untilDate: "2026-01-05" } },
      seed,
      TZ,
    );
    expect(rrule).toMatch(/UNTIL=/);
  });

  it("applies recurrence count", () => {
    const seed = zonedWallClockToUtc({ year: 2026, month: 1, day: 1, hour: 9 }, TZ);
    const rrule = buildRruleString(
      { frequency: "daily", end: { type: "count", count: 5 } },
      seed,
      TZ,
    );
    expect(rrule).toMatch(/COUNT=5/);
  });

  it("returns null for non-recurring events", () => {
    const seed = new Date("2026-01-01T15:00:00.000Z");
    expect(buildRruleString({ frequency: "none" }, seed, TZ)).toBeNull();
  });
});

describe("expandOccurrences", () => {
  const rangeStart = new Date("2026-01-01T00:00:00.000Z");
  const rangeEnd = new Date("2026-12-31T23:59:59.999Z");

  it("expands daily occurrences within range", () => {
    const seed = zonedWallClockToUtc({ year: 2026, month: 1, day: 1, hour: 10 }, TZ);
    const endsAt = new Date(seed.getTime() + 30 * 60_000);
    const rrule = buildRruleString(
      { frequency: "daily", end: { type: "count", count: 3 } },
      seed,
      TZ,
    );
    const occ = expandOccurrences({
      allDay: false,
      startsAt: seed,
      endsAt,
      startDate: null,
      endDateExclusive: null,
      timeZone: TZ,
      rrule,
      rangeStart,
      rangeEnd,
    });
    expect(occ).toHaveLength(3);
    expect(occ[0]!.originalStartsAt).toBe(occ[0]!.startsAt);
  });

  it("expands weekly occurrences", () => {
    const { startsAt, endsAt, rrule } = weeklyAtNineAmChicago({ year: 2026, month: 1, day: 4 });
    const occ = expandOccurrences({
      allDay: false,
      startsAt,
      endsAt,
      startDate: null,
      endDateExclusive: null,
      timeZone: TZ,
      rrule,
      rangeStart: new Date("2026-01-01T00:00:00.000Z"),
      rangeEnd: new Date("2026-02-01T00:00:00.000Z"),
    });
    expect(occ.length).toBeGreaterThanOrEqual(4);
    for (const o of occ) {
      const parts = getZonedParts(new Date(o.startsAt), TZ);
      expect(parts.hour).toBe(9);
      expect(parts.minute).toBe(0);
    }
  });

  it("expands biweekly occurrences", () => {
    const seed = zonedWallClockToUtc({ year: 2026, month: 1, day: 5, hour: 9 }, TZ);
    const endsAt = new Date(seed.getTime() + 60 * 60_000);
    const rrule = buildRruleString(biweeklyRrule(), seed, TZ);
    const occ = expandOccurrences({
      allDay: false,
      startsAt: seed,
      endsAt,
      startDate: null,
      endDateExclusive: null,
      timeZone: TZ,
      rrule,
      rangeStart,
      rangeEnd: new Date("2026-03-01T00:00:00.000Z"),
    });
    expect(occ).toHaveLength(4);
    const gapDays =
      (new Date(occ[1]!.startsAt).getTime() - new Date(occ[0]!.startsAt).getTime()) /
      86_400_000;
    expect(gapDays).toBe(14);
  });

  it("expands monthly occurrences (first Saturday)", () => {
    const seed = zonedWallClockToUtc({ year: 2026, month: 1, day: 3, hour: 9 }, TZ);
    const endsAt = new Date(seed.getTime() + 60 * 60_000);
    const rrule = buildRruleString(firstSaturdayMonthly(), seed, TZ);
    const occ = expandOccurrences({
      allDay: false,
      startsAt: seed,
      endsAt,
      startDate: null,
      endDateExclusive: null,
      timeZone: TZ,
      rrule,
      rangeStart,
      rangeEnd: new Date("2026-04-01T00:00:00.000Z"),
    });
    expect(occ.length).toBeGreaterThanOrEqual(3);
    for (const o of occ) {
      const parts = getZonedParts(new Date(o.startsAt), TZ);
      expect(parts.day).toBeLessThanOrEqual(7);
    }
  });

  it("respects recurrence end date", () => {
    const seed = zonedWallClockToUtc({ year: 2026, month: 1, day: 1, hour: 9 }, TZ);
    const endsAt = new Date(seed.getTime() + 60 * 60_000);
    const rrule = buildRruleString(
      { frequency: "daily", end: { type: "until", untilDate: "2026-01-03" } },
      seed,
      TZ,
    );
    const occ = expandOccurrences({
      allDay: false,
      startsAt: seed,
      endsAt,
      startDate: null,
      endDateExclusive: null,
      timeZone: TZ,
      rrule,
      rangeStart,
      rangeEnd,
    });
    expect(occ.length).toBeLessThanOrEqual(3);
    for (const o of occ) {
      const parts = getZonedParts(new Date(o.startsAt), TZ);
      expect(parts.month).toBe(1);
      expect(parts.day).toBeLessThanOrEqual(3);
    }
  });

  it("respects recurrence count", () => {
    const seed = zonedWallClockToUtc({ year: 2026, month: 1, day: 1, hour: 9 }, TZ);
    const endsAt = new Date(seed.getTime() + 60 * 60_000);
    const rrule = buildRruleString(
      { frequency: "daily", end: { type: "count", count: 4 } },
      seed,
      TZ,
    );
    const occ = expandOccurrences({
      allDay: false,
      startsAt: seed,
      endsAt,
      startDate: null,
      endDateExclusive: null,
      timeZone: TZ,
      rrule,
      rangeStart,
      rangeEnd,
    });
    expect(occ).toHaveLength(4);
  });

  it("skips cancelled exception dates", () => {
    const { startsAt, endsAt, rrule } = weeklyAtNineAmChicago({ year: 2026, month: 1, day: 4 });
    const first = expandOccurrences({
      allDay: false,
      startsAt,
      endsAt,
      startDate: null,
      endDateExclusive: null,
      timeZone: TZ,
      rrule,
      rangeStart,
      rangeEnd: new Date("2026-02-01T00:00:00.000Z"),
    });
    const cancelledKey = first[1]!.originalStartsAt;
    const occ = expandOccurrences({
      allDay: false,
      startsAt,
      endsAt,
      startDate: null,
      endDateExclusive: null,
      timeZone: TZ,
      rrule,
      rangeStart,
      rangeEnd: new Date("2026-02-01T00:00:00.000Z"),
      exceptions: [{ originalStartsAt: cancelledKey, kind: "cancelled" }],
    });
    expect(occ.some((o) => o.originalStartsAt === cancelledKey)).toBe(false);
    expect(occ.length).toBe(first.length - 1);
  });

  it("applies edited occurrence overrides", () => {
    const { startsAt, endsAt, rrule } = weeklyAtNineAmChicago({ year: 2026, month: 1, day: 4 });
    const baseline = expandOccurrences({
      allDay: false,
      startsAt,
      endsAt,
      startDate: null,
      endDateExclusive: null,
      timeZone: TZ,
      rrule,
      rangeStart,
      rangeEnd: new Date("2026-02-01T00:00:00.000Z"),
    });
    const target = baseline[1]!;
    const overrideStart = new Date(new Date(target.startsAt).getTime() + 2 * 60 * 60_000).toISOString();
    const overrideEnd = new Date(new Date(target.endsAt).getTime() + 2 * 60 * 60_000).toISOString();
    const occ = expandOccurrences({
      allDay: false,
      startsAt,
      endsAt,
      startDate: null,
      endDateExclusive: null,
      timeZone: TZ,
      rrule,
      rangeStart,
      rangeEnd: new Date("2026-02-01T00:00:00.000Z"),
      exceptions: [
        {
          originalStartsAt: target.originalStartsAt,
          kind: "override",
          startsAt: overrideStart,
          endsAt: overrideEnd,
        },
      ],
    });
    const overridden = occ.find((o) => o.originalStartsAt === target.originalStartsAt);
    expect(overridden?.startsAt).toBe(overrideStart);
    expect(overridden?.endsAt).toBe(overrideEnd);
  });

  it("expands a single non-recurring timed event (series-like baseline)", () => {
    const startsAt = new Date("2026-06-15T14:00:00.000Z");
    const endsAt = new Date("2026-06-15T15:00:00.000Z");
    const occ = expandOccurrences({
      allDay: false,
      startsAt,
      endsAt,
      startDate: null,
      endDateExclusive: null,
      timeZone: TZ,
      rrule: null,
      rangeStart,
      rangeEnd,
    });
    expect(occ).toHaveLength(1);
    expect(occ[0]!.originalStartsAt).toBe(startsAt.toISOString());
  });

  it("preserves 9:00 AM wall clock across DST spring-forward for weekly Sunday events", () => {
    // Seed: Sunday Feb 22, 2026 9:00 AM CST — spans March 8 spring-forward
    const { startsAt, endsAt, rrule } = weeklyAtNineAmChicago({ year: 2026, month: 2, day: 22 });
    const occ = expandOccurrences({
      allDay: false,
      startsAt,
      endsAt,
      startDate: null,
      endDateExclusive: null,
      timeZone: TZ,
      rrule,
      rangeStart: new Date("2026-02-15T00:00:00.000Z"),
      rangeEnd: new Date("2026-03-22T00:00:00.000Z"),
    });
    expect(occ.length).toBeGreaterThanOrEqual(3);
    for (const o of occ) {
      const parts = getZonedParts(new Date(o.startsAt), TZ);
      expect(parts.hour).toBe(9);
      expect(parts.minute).toBe(0);
    }
    // Occurrence on March 8 (spring-forward Sunday) still reads 9:00 locally
    const march8 = occ.find((o) => {
      const p = getZonedParts(new Date(o.startsAt), TZ);
      return p.year === 2026 && p.month === 3 && p.day === 8;
    });
    expect(march8).toBeDefined();
    const march8Parts = getZonedParts(new Date(march8!.startsAt), TZ);
    expect(march8Parts).toMatchObject({ hour: 9, minute: 0 });
  });

  it("preserves 9:00 AM wall clock across DST fall-back for weekly Sunday events", () => {
    const { startsAt, endsAt, rrule } = weeklyAtNineAmChicago({ year: 2026, month: 10, day: 25 });
    const occ = expandOccurrences({
      allDay: false,
      startsAt,
      endsAt,
      startDate: null,
      endDateExclusive: null,
      timeZone: TZ,
      rrule,
      rangeStart: new Date("2026-10-20T00:00:00.000Z"),
      rangeEnd: new Date("2026-11-15T00:00:00.000Z"),
    });
    const nov1 = occ.find((o) => {
      const p = getZonedParts(new Date(o.startsAt), TZ);
      return p.year === 2026 && p.month === 11 && p.day === 1;
    });
    expect(nov1).toBeDefined();
    const nov1Parts = getZonedParts(new Date(nov1!.startsAt), TZ);
    expect(nov1Parts).toMatchObject({ hour: 9, minute: 0 });
  });
});

describe("horizon constants", () => {
  it("exposes bounded occurrence horizon constants", () => {
    expect(OCCURRENCE_HORIZON_PAST_DAYS).toBe(90);
    expect(OCCURRENCE_HORIZON_FUTURE_DAYS).toBe(180);
  });

  it("defaultHorizon spans past and future days from now", () => {
    const now = new Date("2026-06-01T12:00:00.000Z");
    const { rangeStart, rangeEnd } = defaultHorizon(now);
    const pastMs = now.getTime() - rangeStart.getTime();
    const futureMs = rangeEnd.getTime() - now.getTime();
    expect(Math.round(pastMs / 86_400_000)).toBe(90);
    expect(Math.round(futureMs / 86_400_000)).toBe(180);
  });
});
