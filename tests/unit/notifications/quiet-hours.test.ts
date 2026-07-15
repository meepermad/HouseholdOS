import { describe, expect, it } from "vitest";
import { DEFAULT_TIMEZONE } from "@/lib/time";
import {
  getLocalParts,
  isWithinQuietHours,
  nextQuietHoursEnd,
  parseHhMm,
  resolveAvailableAt,
  resolveTimeZone,
  zonedLocalToUtc,
  type QuietHoursConfig,
} from "@/lib/notifications/quiet-hours";

const sameDay: QuietHoursConfig = {
  enabled: true,
  startLocal: "09:00",
  endLocal: "17:00",
  timeZone: "UTC",
  allowUrgentOverride: true,
};

const overnight: QuietHoursConfig = {
  enabled: true,
  startLocal: "22:00",
  endLocal: "07:00",
  timeZone: "UTC",
  allowUrgentOverride: true,
};

describe("quiet hours", () => {
  it("parses HH:MM and falls back timezone", () => {
    expect(parseHhMm("22:30")).toEqual({ hour: 22, minute: 30 });
    expect(parseHhMm("invalid")).toBeNull();
    expect(resolveTimeZone(null)).toBe(DEFAULT_TIMEZONE);
    expect(resolveTimeZone("Not/A/Zone")).toBe(DEFAULT_TIMEZONE);
    expect(resolveTimeZone("America/New_York")).toBe("America/New_York");
  });

  it("detects same-day quiet windows", () => {
    expect(isWithinQuietHours(new Date("2026-07-15T12:00:00Z"), sameDay)).toBe(
      true,
    );
    expect(isWithinQuietHours(new Date("2026-07-15T08:59:00Z"), sameDay)).toBe(
      false,
    );
    expect(isWithinQuietHours(new Date("2026-07-15T17:00:00Z"), sameDay)).toBe(
      false,
    );
  });

  it("detects overnight windows spanning midnight", () => {
    expect(isWithinQuietHours(new Date("2026-07-15T23:00:00Z"), overnight)).toBe(
      true,
    );
    expect(isWithinQuietHours(new Date("2026-07-16T03:00:00Z"), overnight)).toBe(
      true,
    );
    expect(isWithinQuietHours(new Date("2026-07-15T12:00:00Z"), overnight)).toBe(
      false,
    );
    expect(isWithinQuietHours(new Date("2026-07-16T07:00:00Z"), overnight)).toBe(
      false,
    );
  });

  it("converts local wall clock to UTC around timezone offsets", () => {
    const utc = zonedLocalToUtc(
      { year: 2026, month: 7, day: 15, hour: 8, minute: 0 },
      "America/Chicago",
    );
    const parts = getLocalParts(utc, "America/Chicago");
    expect(parts.hour).toBe(8);
    expect(parts.minute).toBe(0);
    expect(parts.day).toBe(15);
  });

  it("returns next quiet-hours end for same-day and overnight", () => {
    const sameEnd = nextQuietHoursEnd(
      new Date("2026-07-15T12:00:00Z"),
      sameDay,
    );
    expect(sameEnd.toISOString()).toBe("2026-07-15T17:00:00.000Z");

    const overnightEnd = nextQuietHoursEnd(
      new Date("2026-07-15T23:30:00Z"),
      overnight,
    );
    expect(overnightEnd.toISOString()).toBe("2026-07-16T07:00:00.000Z");
  });

  it("resolveAvailableAt defers unless urgent override applies", () => {
    const now = new Date("2026-07-15T12:00:00Z");
    const deferred = resolveAvailableAt(now, sameDay, "normal");
    expect(deferred.toISOString()).toBe("2026-07-15T17:00:00.000Z");

    const urgent = resolveAvailableAt(now, sameDay, "urgent");
    expect(urgent.getTime()).toBe(now.getTime());

    const noOverride = resolveAvailableAt(
      now,
      { ...sameDay, allowUrgentOverride: false },
      "urgent",
    );
    expect(noOverride.toISOString()).toBe("2026-07-15T17:00:00.000Z");

    const disabled = resolveAvailableAt(
      now,
      { ...sameDay, enabled: false },
      "normal",
    );
    expect(disabled.getTime()).toBe(now.getTime());
  });
});
