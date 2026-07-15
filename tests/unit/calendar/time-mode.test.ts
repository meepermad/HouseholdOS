import { describe, expect, it } from "vitest";
import { DEFAULT_TIMEZONE } from "@/lib/time";
import {
  getZonedParts,
  isValidIanaTimeZone,
  validateEventTimeMode,
  zonedWallClockToUtc,
} from "@/lib/calendar/time-mode";

describe("validateEventTimeMode", () => {
  it("accepts a valid timed event", () => {
    const result = validateEventTimeMode({
      allDay: false,
      startsAt: "2026-03-01T15:00:00.000Z",
      endsAt: "2026-03-01T16:00:00.000Z",
      timeZone: "America/Chicago",
    });
    expect(result).toEqual({ ok: true, mode: "timed", timeZone: "America/Chicago" });
  });

  it("accepts a valid all-day event", () => {
    const result = validateEventTimeMode({
      allDay: true,
      startDate: "2026-03-01",
      endDateExclusive: "2026-03-02",
    });
    expect(result).toEqual({ ok: true, mode: "all_day", timeZone: DEFAULT_TIMEZONE });
  });

  it("rejects mixed timed and all-day fields", () => {
    const timedWithDates = validateEventTimeMode({
      allDay: false,
      startsAt: "2026-03-01T15:00:00.000Z",
      endsAt: "2026-03-01T16:00:00.000Z",
      startDate: "2026-03-01",
    });
    expect(timedWithDates).toEqual({
      ok: false,
      error: "Timed events cannot include all-day date fields.",
    });

    const allDayWithTimestamps = validateEventTimeMode({
      allDay: true,
      startDate: "2026-03-01",
      endDateExclusive: "2026-03-02",
      startsAt: "2026-03-01T15:00:00.000Z",
    });
    expect(allDayWithTimestamps).toEqual({
      ok: false,
      error: "All-day events cannot include timed timestamps.",
    });
  });

  it("defaults to America/Chicago when timezone is omitted", () => {
    const result = validateEventTimeMode({
      allDay: false,
      startsAt: "2026-03-01T15:00:00.000Z",
      endsAt: "2026-03-01T16:00:00.000Z",
    });
    expect(result).toEqual({ ok: true, mode: "timed", timeZone: "America/Chicago" });
  });

  it("accepts an alternate valid IANA timezone", () => {
    const result = validateEventTimeMode({
      allDay: false,
      startsAt: "2026-03-01T15:00:00.000Z",
      endsAt: "2026-03-01T16:00:00.000Z",
      timeZone: "America/New_York",
    });
    expect(result).toEqual({ ok: true, mode: "timed", timeZone: "America/New_York" });
  });

  it("rejects an invalid timezone", () => {
    const result = validateEventTimeMode({
      allDay: false,
      startsAt: "2026-03-01T15:00:00.000Z",
      endsAt: "2026-03-01T16:00:00.000Z",
      timeZone: "Not/A_Real_Zone",
    });
    expect(result).toEqual({ ok: false, error: "Invalid timezone." });
  });

  it("rejects timed events with end before or equal to start", () => {
    const result = validateEventTimeMode({
      allDay: false,
      startsAt: "2026-03-01T16:00:00.000Z",
      endsAt: "2026-03-01T15:00:00.000Z",
    });
    expect(result).toEqual({ ok: false, error: "Event end must be after start." });
  });

  it("rejects all-day events with invalid or non-exclusive end date", () => {
    const badFormat = validateEventTimeMode({
      allDay: true,
      startDate: "2026-03-01",
      endDateExclusive: "03/02/2026",
    });
    expect(badFormat.ok).toBe(false);

    const sameDay = validateEventTimeMode({
      allDay: true,
      startDate: "2026-03-01",
      endDateExclusive: "2026-03-01",
    });
    expect(sameDay).toEqual({
      ok: false,
      error: "All-day exclusive end date must be after the start date.",
    });
  });
});

describe("isValidIanaTimeZone", () => {
  it("recognizes valid and invalid zones", () => {
    expect(isValidIanaTimeZone("America/Chicago")).toBe(true);
    expect(isValidIanaTimeZone("")).toBe(false);
    expect(isValidIanaTimeZone("Fake/Zone")).toBe(false);
  });
});

describe("zonedWallClockToUtc — DST transitions (America/Chicago)", () => {
  const tz = "America/Chicago";

  it("maps 2:30 AM on spring-forward day to 3:30 AM CDT (nonexistent hour skipped)", () => {
    // March 8, 2026: clocks jump 2:00 → 3:00 AM
    const utc = zonedWallClockToUtc(
      { year: 2026, month: 3, day: 8, hour: 2, minute: 30 },
      tz,
    );
    const parts = getZonedParts(utc, tz);
    expect(parts).toMatchObject({ year: 2026, month: 3, day: 8, hour: 3, minute: 30 });
  });

  it("preserves 1:30 AM wall clock on fall-back day (first occurrence)", () => {
    // November 1, 2026: 1:00–1:59 occurs twice; first is CDT
    const utc = zonedWallClockToUtc(
      { year: 2026, month: 11, day: 1, hour: 1, minute: 30 },
      tz,
    );
    const parts = getZonedParts(utc, tz);
    expect(parts).toMatchObject({ year: 2026, month: 11, day: 1, hour: 1, minute: 30 });
    // First 1:30 AM CDT = 06:30 UTC
    expect(utc.toISOString()).toBe("2026-11-01T06:30:00.000Z");
  });

  it("round-trips a normal wall clock outside DST transitions", () => {
    const utc = zonedWallClockToUtc(
      { year: 2026, month: 1, day: 15, hour: 9, minute: 0 },
      tz,
    );
    const parts = getZonedParts(utc, tz);
    expect(parts).toMatchObject({ year: 2026, month: 1, day: 15, hour: 9, minute: 0 });
  });
});
