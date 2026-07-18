import { describe, expect, it } from "vitest";
import {
  AGENDA_RULES_VERSION,
  suggestAgendaItems,
  DEFAULT_AGENDA_RULE_CONFIG,
} from "@/lib/meetings/agenda-rules";

describe("meeting packet privacy shape", () => {
  it("exposes a stable agenda rules version for packet generation", () => {
    expect(AGENDA_RULES_VERSION).toBe("1");
  });

  it("keeps dispute and routed items as suggested agenda without pairwise amounts", () => {
    const items = suggestAgendaItems(
      {
        openDisputes: [{ id: "d1" }],
        sharedPurchases: [],
        openPolls: [],
        pendingGovernance: [],
        unownedResponsibilities: [],
        supplyRunouts: [],
        maintenanceWaiting: [],
        choreMissPatterns: [],
        utilityVariances: [],
        openPriorActions: [],
        routedProposals: [{ id: "r1", amountCents: 4200 }],
        today: "2026-07-18",
      },
      DEFAULT_AGENDA_RULE_CONFIG,
    );
    expect(items.some((i) => i.sectionKey === "money")).toBe(true);
    for (const item of items) {
      expect(JSON.stringify(item)).not.toMatch(/youOwe|privateFollowUps/);
    }
  });
});
