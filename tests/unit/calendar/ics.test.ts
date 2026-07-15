import { describe, expect, it } from "vitest";
import {
  buildIcalendar,
  buildVevent,
  escapeIcsText,
  foldIcsLine,
} from "@/lib/calendar/ics";
import { buildRruleString } from "@/lib/calendar/recurrence";
import { zonedWallClockToUtc } from "@/lib/calendar/time-mode";

const TZ = "America/Chicago";

describe("escapeIcsText", () => {
  it("escapes backslashes, semicolons, commas, and newlines", () => {
    expect(escapeIcsText("a\\b;c,d\ne")).toBe("a\\\\b\\;c\\,d\\ne");
    expect(escapeIcsText("line1\r\nline2")).toBe("line1\\nline2");
  });
});

describe("foldIcsLine", () => {
  it("folds long lines at 75 octets with CRLF + space", () => {
    const long = "A".repeat(80);
    const folded = foldIcsLine(long);
    expect(folded.startsWith("A".repeat(75))).toBe(true);
    expect(folded).toContain("\r\n ");
  });

  it("returns short lines unchanged", () => {
    expect(foldIcsLine("SHORT")).toBe("SHORT");
  });
});

describe("buildVevent — timed events", () => {
  it("emits TZID local floating timestamps for timed events", () => {
    const startsAt = zonedWallClockToUtc(
      { year: 2026, month: 3, day: 1, hour: 10, minute: 0 },
      TZ,
    );
    const endsAt = new Date(startsAt.getTime() + 60 * 60_000);
    const vevent = buildVevent({
      uid: "test@householdos.app",
      sequence: 0,
      lastModified: new Date("2026-01-01T00:00:00.000Z"),
      summary: "Team sync",
      status: "CONFIRMED",
      allDay: false,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      timeZone: TZ,
    });
    expect(vevent).toContain("BEGIN:VEVENT");
    expect(vevent).toContain("DTSTART;TZID=America/Chicago:20260301T100000");
    expect(vevent).toContain("DTEND;TZID=America/Chicago:20260301T110000");
    expect(vevent).toContain("STATUS:CONFIRMED");
  });
});

describe("buildVevent — all-day events", () => {
  it("emits VALUE=DATE for all-day events", () => {
    const vevent = buildVevent({
      uid: "allday@householdos.app",
      sequence: 0,
      lastModified: new Date("2026-01-01T00:00:00.000Z"),
      summary: "Holiday",
      status: "CONFIRMED",
      allDay: true,
      startDate: "2026-07-04",
      endDateExclusive: "2026-07-05",
    });
    expect(vevent).toContain("DTSTART;VALUE=DATE:20260704");
    expect(vevent).toContain("DTEND;VALUE=DATE:20260705");
    expect(vevent).not.toContain("TZID=");
  });
});

describe("buildVevent — recurring events", () => {
  it("includes RRULE line without DTSTART prefix", () => {
    const seed = zonedWallClockToUtc({ year: 2026, month: 1, day: 5, hour: 9 }, TZ);
    const rrule = buildRruleString({ frequency: "weekly" }, seed, TZ);
    const endsAt = new Date(seed.getTime() + 60 * 60_000);
    const vevent = buildVevent({
      uid: "recur@householdos.app",
      sequence: 1,
      lastModified: new Date("2026-01-01T00:00:00.000Z"),
      summary: "Weekly standup",
      status: "CONFIRMED",
      allDay: false,
      startsAt: seed.toISOString(),
      endsAt: endsAt.toISOString(),
      timeZone: TZ,
      rrule,
    });
    expect(vevent).toContain("RRULE:FREQ=WEEKLY");
    expect(rrule).not.toMatch(/^DTSTART/);
    expect(vevent).toMatch(/DTSTART;TZID=America\/Chicago:/);
  });
});

describe("buildVevent — cancelled events", () => {
  it("emits STATUS:CANCELLED", () => {
    const vevent = buildVevent({
      uid: "cancel@householdos.app",
      sequence: 2,
      lastModified: new Date("2026-01-01T00:00:00.000Z"),
      summary: "Cancelled meeting",
      status: "CANCELLED",
      allDay: true,
      startDate: "2026-05-01",
      endDateExclusive: "2026-05-02",
    });
    expect(vevent).toContain("STATUS:CANCELLED");
  });
});

describe("buildIcalendar", () => {
  it("wraps events in a VCALENDAR envelope", () => {
    const cal = buildIcalendar({
      calendarName: "Household Calendar",
      events: [
        {
          uid: "one@householdos.app",
          sequence: 0,
          lastModified: new Date("2026-01-01T00:00:00.000Z"),
          summary: "Dinner",
          status: "CONFIRMED",
          allDay: true,
          startDate: "2026-06-01",
          endDateExclusive: "2026-06-02",
        },
      ],
    });
    expect(cal).toMatch(/^BEGIN:VCALENDAR/);
    expect(cal).toContain("VERSION:2.0");
    expect(cal).toContain("X-WR-CALNAME:Household Calendar");
    expect(cal).toContain("BEGIN:VEVENT");
    expect(cal).toMatch(/END:VCALENDAR\r\n$/);
  });
});
