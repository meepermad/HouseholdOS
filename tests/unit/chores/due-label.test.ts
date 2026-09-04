import { describe, expect, it } from "vitest";
import { choreDueLabel } from "@/lib/chores/display";

describe("choreDueLabel", () => {
  const now = new Date("2026-09-04T18:00:00");

  it("uses overdue language instead of state names", () => {
    expect(
      choreDueLabel({
        dueAt: "2026-09-02T00:00:00",
        now,
      }),
    ).toBe("2 days overdue");
  });

  it("says due tonight for all-day chores on the current day", () => {
    expect(
      choreDueLabel({
        dueAt: "2026-09-04T23:59:00",
        allDay: true,
        now,
      }),
    ).toBe("Due tonight");
  });
});
