import { describe, expect, it } from "vitest";
import {
  allocateQuantityClaims,
  allocateSharedLine,
  canClaimQuantity,
  claimedQuantity,
  conflictUserMessage,
  remainingQuantity,
} from "@/lib/receipts/claims";
import {
  classificationToSimpleOwnership,
  simpleOwnershipToClassification,
} from "@/lib/receipts/ownership";
import { previewReceiptSplit } from "@/lib/receipts/split-preview";
import { receiptDraftHeadline } from "@/lib/receipts/draft-status";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const D = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

describe("receipt claims", () => {
  it("lets a member claim one item", () => {
    expect(
      canClaimQuantity({
        totalQuantity: 1,
        existing: [],
        requestedQuantity: 1,
        actorMembershipId: A,
      }).ok,
    ).toBe(true);
  });

  it("rejects a second claim on an indivisible item", () => {
    const result = canClaimQuantity({
      totalQuantity: 1,
      existing: [{ membershipId: A, quantity: 1, kind: "mine" }],
      requestedQuantity: 1,
      actorMembershipId: B,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.conflict.type).toBe("already_claimed");
      expect(conflictUserMessage(result.conflict, () => "Andrew")).toMatch(/Andrew/);
    }
  });

  it("splits quantity across members", () => {
    const allocated = allocateQuantityClaims({
      totalCents: 1200,
      totalQuantity: 4,
      claims: [
        { membershipId: A, quantity: 1, kind: "quantity" },
        { membershipId: B, quantity: 2, kind: "quantity" },
        { membershipId: C, quantity: 1, kind: "quantity" },
      ],
    });
    expect(allocated.find((x) => x.membershipId === A)?.amountCents).toBe(300);
    expect(allocated.find((x) => x.membershipId === B)?.amountCents).toBe(600);
    expect(allocated.find((x) => x.membershipId === C)?.amountCents).toBe(300);
    expect(allocated.reduce((sum, x) => sum + x.amountCents, 0)).toBe(1200);
  });

  it("rejects overclaim", () => {
    const result = canClaimQuantity({
      totalQuantity: 4,
      existing: [
        { membershipId: A, quantity: 1, kind: "quantity" },
        { membershipId: B, quantity: 2, kind: "quantity" },
      ],
      requestedQuantity: 2,
      actorMembershipId: C,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.conflict.type).toBe("overclaim");
  });

  it("unclaims by ignoring retracted-style remaining math", () => {
    expect(
      remainingQuantity(1, [{ membershipId: A, quantity: 1, kind: "mine" }]),
    ).toBe(0);
    expect(remainingQuantity(1, [])).toBe(1);
    expect(
      claimedQuantity([{ membershipId: A, quantity: 1, kind: "shared" }]),
    ).toBe(0);
  });

  it("allocates a shared line equally with leftover cents", () => {
    const split = allocateSharedLine({
      totalCents: 1299,
      membershipIds: [A, B, C, D],
    });
    expect(split.reduce((sum, x) => sum + x.amountCents, 0)).toBe(1299);
    const amounts = split.map((x) => x.amountCents).sort((a, b) => a - b);
    expect(amounts[0]).toBe(324);
    expect(amounts[3]).toBe(325);
  });
});

describe("simple ownership mapping", () => {
  it("hides allocation-mode names", () => {
    expect(
      classificationToSimpleOwnership({
        classification: "personal_purchaser",
        participantMembershipIds: [],
        currentMembershipId: A,
        payerMembershipId: A,
      }).kind,
    ).toBe("mine");
    expect(
      simpleOwnershipToClassification({
        kind: "household",
        membershipIds: [],
        currentMembershipId: A,
        payerMembershipId: A,
      }).classification,
    ).toBe("shared_household");
  });

  it("maps someone else, excluded, and unclaimed without allocation-mode names", () => {
    expect(
      classificationToSimpleOwnership({
        classification: "personal_other",
        participantMembershipIds: [B],
        currentMembershipId: A,
        payerMembershipId: A,
      }).kind,
    ).toBe("someone_else");
    expect(
      simpleOwnershipToClassification({
        kind: "excluded",
        membershipIds: [],
        currentMembershipId: A,
        payerMembershipId: A,
      }).classification,
    ).toBe("excluded");
    expect(
      classificationToSimpleOwnership({
        classification: "needs_review",
        participantMembershipIds: [],
        currentMembershipId: A,
        payerMembershipId: A,
      }).kind,
    ).toBe("unclaimed");
  });
});

describe("split preview", () => {
  it("splits the whole receipt equally", () => {
    const preview = previewReceiptSplit({
      merchant: "Target",
      payerMembershipId: A,
      eligibleMembershipIds: [A, B, C, D],
      declaredTotalCents: 9240,
      taxCents: 0,
      tipCents: 0,
      lines: [],
      splitEverything: { membershipIds: [A, B, C, D] },
    });
    expect(preview.members.reduce((sum, m) => sum + m.totalCents, 0)).toBe(9240);
    expect(preview.othersOwePayerCents + preview.payerOwnShareCents).toBe(9240);
  });

  it("warns about unclaimed items without inventing an owner", () => {
    const preview = previewReceiptSplit({
      merchant: "Target",
      payerMembershipId: A,
      eligibleMembershipIds: [A, B],
      declaredTotalCents: 2000,
      taxCents: 0,
      tipCents: 0,
      lines: [
        {
          id: "1",
          name: "Milk",
          totalCents: 500,
          classification: "personal_other",
          participantMembershipIds: [B],
          quantity: 1,
        },
        {
          id: "2",
          name: "Soda",
          totalCents: 1500,
          classification: "needs_review",
          participantMembershipIds: [],
          quantity: 1,
        },
      ],
    });
    expect(preview.unclaimed.count).toBe(1);
    expect(preview.unclaimed.cents).toBe(1500);
  });

  it("allocates tax and tip proportionally and keeps the declared total", () => {
    const preview = previewReceiptSplit({
      merchant: "Dinner",
      payerMembershipId: A,
      eligibleMembershipIds: [A, B],
      declaredTotalCents: 3000,
      taxCents: 200,
      tipCents: 800,
      lines: [
        {
          id: "1",
          name: "Pasta",
          totalCents: 1000,
          classification: "personal_purchaser",
          participantMembershipIds: [],
          quantity: 1,
        },
        {
          id: "2",
          name: "Salad",
          totalCents: 1000,
          classification: "personal_other",
          participantMembershipIds: [B],
          quantity: 1,
        },
      ],
    });
    expect(preview.taxCents).toBe(200);
    expect(preview.tipCents).toBe(800);
    expect(preview.members.reduce((sum, m) => sum + m.totalCents, 0)).toBe(3000);
    expect(preview.othersOwePayerCents + preview.payerOwnShareCents).toBe(3000);
  });

  it("allocates a discount without breaking the declared total", () => {
    const preview = previewReceiptSplit({
      merchant: "Target",
      payerMembershipId: A,
      eligibleMembershipIds: [A, B],
      declaredTotalCents: 1900,
      taxCents: 0,
      tipCents: 0,
      discountCents: 100,
      lines: [
        {
          id: "1",
          name: "Milk",
          totalCents: 1000,
          classification: "personal_purchaser",
          participantMembershipIds: [],
          quantity: 1,
        },
        {
          id: "2",
          name: "Bread",
          totalCents: 1000,
          classification: "personal_other",
          participantMembershipIds: [B],
          quantity: 1,
        },
      ],
    });
    expect(preview.discountCents).toBe(100);
    expect(preview.members.reduce((sum, m) => sum + m.totalCents, 0)).toBe(1900);
  });

  it("keeps excluded lines out of what roommates owe", () => {
    const preview = previewReceiptSplit({
      merchant: "Target",
      payerMembershipId: A,
      eligibleMembershipIds: [A, B],
      declaredTotalCents: 1000,
      taxCents: 0,
      tipCents: 0,
      lines: [
        {
          id: "1",
          name: "Milk",
          totalCents: 1000,
          classification: "personal_other",
          participantMembershipIds: [B],
          quantity: 1,
        },
        {
          id: "2",
          name: "Gift card",
          totalCents: 2500,
          classification: "excluded",
          participantMembershipIds: [],
          quantity: 1,
        },
      ],
    });
    expect(preview.excludedCents).toBe(2500);
    expect(preview.members.reduce((sum, m) => sum + m.totalCents, 0)).toBe(1000);
  });

  it("uses quantity claims for mixed personal items", () => {
    const preview = previewReceiptSplit({
      merchant: "Target",
      payerMembershipId: A,
      eligibleMembershipIds: [A, B, C],
      declaredTotalCents: 1200,
      taxCents: 0,
      tipCents: 0,
      lines: [
        {
          id: "1",
          name: "Energy drinks",
          totalCents: 1200,
          classification: "shared_selected",
          participantMembershipIds: [A, B, C],
          quantity: 4,
          claims: [
            { membershipId: A, quantity: 1, kind: "quantity" },
            { membershipId: B, quantity: 2, kind: "quantity" },
            { membershipId: C, quantity: 1, kind: "quantity" },
          ],
        },
      ],
    });
    expect(preview.members.find((m) => m.membershipId === A)?.totalCents).toBe(300);
    expect(preview.members.find((m) => m.membershipId === B)?.totalCents).toBe(600);
    expect(preview.members.find((m) => m.membershipId === C)?.totalCents).toBe(300);
    expect(preview.members.reduce((sum, m) => sum + m.totalCents, 0)).toBe(1200);
  });
});

describe("draft copy", () => {
  it("never exposes status codes", () => {
    expect(receiptDraftHeadline({ status: "claiming", currentUserNeedsToClaim: true }).title).toBe(
      "Select what is yours",
    );
    expect(receiptDraftHeadline({ status: "claiming", waitingCount: 2, isPayer: true }).title).toMatch(
      /Waiting for 2 people/,
    );
    expect(receiptDraftHeadline({ status: "failed" }).action).toBe("enter_manually");
  });
});
