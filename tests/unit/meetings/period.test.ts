import { describe, expect, it } from "vitest";
import {
  comparisonPeriod,
  meetingReadiness,
  previousCalendarMonth,
  periodSincePreviousMeeting,
} from "@/lib/meetings/period";

describe("meeting period helpers", () => {
  it("previousCalendarMonth returns prior month bounds", () => {
    const period = previousCalendarMonth(new Date("2026-07-18T12:00:00Z"));
    expect(period.start).toBe("2026-06-01");
    expect(period.end).toBe("2026-06-30");
    expect(period.label).toMatch(/June/);
  });

  it("comparisonPeriod mirrors duration before the review window", () => {
    const cmp = comparisonPeriod({
      start: "2026-06-01",
      end: "2026-06-30",
      label: "June 2026",
    });
    expect(cmp.start).toBe("2026-05-02");
    expect(cmp.end).toBe("2026-05-31");
  });

  it("periodSincePreviousMeeting advances from prior end exclusive", () => {
    const period = periodSincePreviousMeeting(
      "2026-05-31",
      new Date("2026-07-18T12:00:00Z"),
    );
    expect(period.start).toBe("2026-06-01");
    expect(period.end).toBe("2026-07-17");
  });

  it("meetingReadiness requires reviewed sections and no warnings", () => {
    const blocked = meetingReadiness({
      sectionsReviewed: 10,
      sectionsTotal: 15,
      decisionsNeeded: 2,
      unacknowledgedParticipants: 1,
      sourceWarnings: 1,
    });
    expect(blocked.ready).toBe(false);

    const ready = meetingReadiness({
      sectionsReviewed: 14,
      sectionsTotal: 15,
      decisionsNeeded: 0,
      unacknowledgedParticipants: 0,
      sourceWarnings: 0,
    });
    expect(ready.ready).toBe(true);
  });
});
