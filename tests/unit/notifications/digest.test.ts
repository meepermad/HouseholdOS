import { describe, expect, it } from "vitest";
import {
  DIGEST_HOUR_LOCAL,
  groupDigestItems,
  nextDigestAt,
} from "@/lib/notifications/digest";
import type { QuietHoursConfig } from "@/lib/notifications/quiet-hours";
import { getLocalParts } from "@/lib/notifications/quiet-hours";

describe("digest scheduling", () => {
  it("schedules next digest at DIGEST_HOUR_LOCAL in the given timezone", () => {
    const now = new Date("2026-07-15T14:00:00Z"); // 09:00 CDT / past 8 local if UTC
    const next = nextDigestAt(now, "UTC");
    const parts = getLocalParts(next, "UTC");
    expect(parts.hour).toBe(DIGEST_HOUR_LOCAL);
    expect(parts.minute).toBe(0);
    expect(parts.day).toBe(16);
  });

  it("uses today when still before digest hour", () => {
    const now = new Date("2026-07-15T06:00:00Z");
    const next = nextDigestAt(now, "UTC");
    const parts = getLocalParts(next, "UTC");
    expect(parts.day).toBe(15);
    expect(parts.hour).toBe(DIGEST_HOUR_LOCAL);
  });

  it("defers digest when quiet hours cover the digest instant", () => {
    const quietHours: QuietHoursConfig = {
      enabled: true,
      startLocal: "07:00",
      endLocal: "10:00",
      timeZone: "UTC",
      allowUrgentOverride: false,
    };
    const now = new Date("2026-07-15T06:00:00Z");
    const next = nextDigestAt(now, "UTC", quietHours);
    expect(next.toISOString()).toBe("2026-07-15T10:00:00.000Z");
  });

  it("groups digest items by household then category", () => {
    const groups = groupDigestItems([
      { householdId: "hh-1", category: "payments", id: "a" },
      { householdId: "hh-2", category: "expenses", id: "b" },
      { householdId: "hh-1", category: "payments", id: "c" },
      { householdId: "hh-1", category: "disputes", id: "d" },
    ]);

    expect(groups).toHaveLength(2);
    const hh1 = groups.find((g) => g.householdId === "hh-1");
    expect(hh1?.categories).toEqual([
      {
        category: "payments",
        items: [
          { householdId: "hh-1", category: "payments", id: "a" },
          { householdId: "hh-1", category: "payments", id: "c" },
        ],
      },
      {
        category: "disputes",
        items: [{ householdId: "hh-1", category: "disputes", id: "d" }],
      },
    ]);
  });
});
