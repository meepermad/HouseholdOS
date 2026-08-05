import { describe, expect, it } from "vitest";
import {
  planReceiptAdjustments,
  planReceiptItem,
} from "@/lib/receipts/expense-handoff";

const PURCHASER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe("planReceiptItem", () => {
  it("assigns a purchaser's personal line to the purchaser", () => {
    expect(
      planReceiptItem({
        classification: "personal_purchaser",
        purchaserMembershipId: PURCHASER,
        participantMembershipIds: [],
      }),
    ).toEqual({
      allocationMode: "personal",
      personalMembershipId: PURCHASER,
      participantMembershipIds: [],
      needsOwner: false,
    });
  });

  it("assigns another member's personal line to the chosen member", () => {
    const plan = planReceiptItem({
      classification: "personal_other",
      purchaserMembershipId: PURCHASER,
      participantMembershipIds: [OTHER],
    });
    expect(plan.allocationMode).toBe("personal");
    expect(plan.personalMembershipId).toBe(OTHER);
    expect(plan.needsOwner).toBe(false);
  });

  it("leaves an unattributed personal line for the member to assign", () => {
    const plan = planReceiptItem({
      classification: "personal_other",
      purchaserMembershipId: PURCHASER,
      participantMembershipIds: [],
    });
    expect(plan.personalMembershipId).toBeNull();
    expect(plan.needsOwner).toBe(true);
  });

  it("creates participant rows for a shared-with-some line", () => {
    const plan = planReceiptItem({
      classification: "shared_selected",
      purchaserMembershipId: PURCHASER,
      participantMembershipIds: [PURCHASER, OTHER],
    });
    expect(plan.allocationMode).toBe("equal_selected");
    expect(plan.participantMembershipIds).toEqual([PURCHASER, OTHER]);
  });

  it("falls back to everyone when a shared line names nobody", () => {
    const plan = planReceiptItem({
      classification: "shared_selected",
      purchaserMembershipId: PURCHASER,
      participantMembershipIds: [],
    });
    expect(plan.allocationMode).toBe("equal_all");
    expect(plan.participantMembershipIds).toEqual([]);
  });

  it("keeps excluded and needs-review lines on their existing meaning", () => {
    expect(
      planReceiptItem({
        classification: "excluded",
        purchaserMembershipId: PURCHASER,
        participantMembershipIds: [],
      }).allocationMode,
    ).toBe("excluded");
    expect(
      planReceiptItem({
        classification: "needs_review",
        purchaserMembershipId: PURCHASER,
        participantMembershipIds: [],
      }).allocationMode,
    ).toBe("equal_all");
  });
});

describe("planReceiptAdjustments", () => {
  it("maps tax and tip into the gap between items and the receipt total", () => {
    expect(
      planReceiptAdjustments({
        declaredTotalCents: 4650,
        itemSubtotalCents: 4000,
        taxCents: 350,
        tipCents: 300,
      }),
    ).toEqual([
      { type: "tax", description: "Tax", amountCents: 350 },
      { type: "tip", description: "Tip", amountCents: 300 },
    ]);
  });

  it("never allocates more than the receipt total", () => {
    const plans = planReceiptAdjustments({
      declaredTotalCents: 4200,
      itemSubtotalCents: 4000,
      taxCents: 350,
      tipCents: 300,
    });
    expect(plans).toEqual([
      { type: "tax", description: "Tax", amountCents: 200 },
    ]);
  });

  it("adds nothing when the line items already cover the total", () => {
    expect(
      planReceiptAdjustments({
        declaredTotalCents: 4000,
        itemSubtotalCents: 4000,
        taxCents: 350,
        tipCents: 300,
      }),
    ).toEqual([]);
  });

  it("adds nothing when extraction found no tax or tip", () => {
    expect(
      planReceiptAdjustments({
        declaredTotalCents: 4650,
        itemSubtotalCents: 4000,
        taxCents: null,
        tipCents: null,
      }),
    ).toEqual([]);
  });
});
