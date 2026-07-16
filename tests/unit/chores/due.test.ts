import { describe, expect, it } from "vitest";
import {
  calculateDueTimestamp,
  gracePeriodEndsAt,
  isChoreOverdue,
} from "@/lib/chores/due";
import { getZonedParts } from "@/lib/calendar/time-mode";

describe("chore due times", () => {
  it("converts a local due time to an absolute timestamp", () => {
    expect(
      calculateDueTimestamp({
        dueDate: "2026-07-16",
        dueTime: "09:30",
        timeZone: "America/Chicago",
      }).toISOString(),
    ).toBe("2026-07-16T14:30:00.000Z");
  });

  it("defaults a date-only deadline to 11:59 PM local time", () => {
    expect(
      calculateDueTimestamp({
        dueDate: "2026-01-15",
        timeZone: "America/Chicago",
      }).toISOString(),
    ).toBe("2026-01-16T05:59:00.000Z");
  });

  it("calculates grace-period end and overdue state", () => {
    const dueAt = new Date("2026-07-16T14:30:00.000Z");
    expect(gracePeriodEndsAt(dueAt, 90).toISOString()).toBe(
      "2026-07-16T16:00:00.000Z",
    );
    expect(
      isChoreOverdue({
        dueAt,
        gracePeriodMinutes: 90,
        now: new Date("2026-07-16T15:59:59.999Z"),
      }),
    ).toBe(false);
    expect(
      isChoreOverdue({
        dueAt,
        gracePeriodMinutes: 90,
        now: new Date("2026-07-16T16:00:00.000Z"),
      }),
    ).toBe(true);
  });

  it("uses DST-safe local wall-clock conversion", () => {
    const springForward = calculateDueTimestamp({
      dueDate: "2026-03-08",
      dueTime: "02:30",
      timeZone: "America/Chicago",
    });
    expect(getZonedParts(springForward, "America/Chicago")).toMatchObject({
      year: 2026,
      month: 3,
      day: 8,
      hour: 3,
      minute: 30,
    });

    const fallBack = calculateDueTimestamp({
      dueDate: "2026-11-01",
      dueTime: "01:30",
      timeZone: "America/Chicago",
    });
    expect(fallBack.toISOString()).toBe("2026-11-01T06:30:00.000Z");
  });

  it("rejects invalid dates, times, timezones, and grace periods", () => {
    expect(() =>
      calculateDueTimestamp({
        dueDate: "2026-02-30",
        dueTime: "09:00",
        timeZone: "America/Chicago",
      }),
    ).toThrow(RangeError);
    expect(() =>
      calculateDueTimestamp({
        dueDate: "2026-02-20",
        dueTime: "24:00",
        timeZone: "America/Chicago",
      }),
    ).toThrow(RangeError);
    expect(() =>
      calculateDueTimestamp({
        dueDate: "2026-02-20",
        dueTime: "09:00",
        timeZone: "Not/A_Zone",
      }),
    ).toThrow(RangeError);
    expect(() =>
      gracePeriodEndsAt(new Date("2026-01-01T00:00:00Z"), -1),
    ).toThrow(RangeError);
  });
});
