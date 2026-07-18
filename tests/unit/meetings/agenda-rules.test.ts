import { describe, expect, it } from "vitest";
import {
  groupFollowUpActions,
  suggestAgendaItems,
} from "@/lib/meetings/agenda-rules";
import {
  comparisonPeriod,
  meetingReadiness,
  previousCalendarMonth,
} from "@/lib/meetings/period";

describe("meeting agenda rules", () => {
  it("includes open disputes and prior actions deterministically", () => {
    const items = suggestAgendaItems({
      openDisputes: [{ id: "d1" }],
      sharedPurchases: [],
      openPolls: [],
      pendingGovernance: [],
      unownedResponsibilities: [],
      supplyRunouts: [],
      maintenanceWaiting: [],
      choreMissPatterns: [],
      utilityVariances: [],
      openPriorActions: [{ id: "a1", title: "Buy trash bags" }],
      routedProposals: [],
      today: "2026-07-18",
    });
    expect(items.map((i) => i.sourceEntityId).sort()).toEqual(["a1", "d1"]);
    expect(items[0]?.whyIncluded).toBeTruthy();
  });

  it("groups follow-up actions without blame language", () => {
    const groups = groupFollowUpActions(
      [
        { id: "1", title: "Done", status: "completed" },
        { id: "2", title: "Late", status: "open", dueDate: "2026-07-01" },
        { id: "3", title: "Open", status: "open", dueDate: "2026-08-01" },
      ],
      "2026-07-18",
    );
    expect(groups.completed).toHaveLength(1);
    expect(groups.overdue).toHaveLength(1);
    expect(groups.still_open).toHaveLength(1);
  });
});

describe("meeting periods", () => {
  it("computes previous calendar month and comparison period", () => {
    const period = previousCalendarMonth(new Date(2026, 6, 18, 12, 0, 0));
    expect(period.start).toBe("2026-06-01");
    expect(period.end).toBe("2026-06-30");
    const cmp = comparisonPeriod(period);
    expect(cmp.end < period.start).toBe(true);
  });

  it("summarizes readiness", () => {
    const r = meetingReadiness({
      sectionsReviewed: 12,
      sectionsTotal: 15,
      decisionsNeeded: 3,
      unacknowledgedParticipants: 2,
      sourceWarnings: 1,
    });
    expect(r.ready).toBe(false);
    expect(r.summaryLines[0]).toMatch(/Needs attention|Ready/);
  });
});
