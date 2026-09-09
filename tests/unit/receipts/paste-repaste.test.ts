import { describe, expect, it } from "vitest";
import { parseHouseholdOsReceipt } from "@/lib/receipts/paste/parse";
import { reconcileReceiptLines } from "@/lib/receipts/paste/line-reconcile";
import { buildRepastePlan } from "@/lib/receipts/paste/repaste-plan";
import { REPASTE_CHANGE_LABELS } from "@/lib/receipts/paste/repaste-diff";
import {
  PASTE_FIXTURE_ALDI_AUG20,
  PASTE_FIXTURE_ALDI_AUG20_CORRECTED,
  PASTE_FIXTURE_WALMART_TRASH,
  PASTE_FIXTURE_WALMART_TRASH_CORRECTED,
} from "@/lib/receipts/paste/fixtures";
import type { CurrentRepasteSnapshot } from "@/lib/receipts/paste/repaste-plan";
import type { ParsedPasteReceipt } from "@/lib/receipts/paste/parse";

function snapshotFromParsed(
  receiptId: string,
  parsed: ParsedPasteReceipt,
  extra?: Partial<CurrentRepasteSnapshot> & {
    lineExtras?: Array<Partial<CurrentRepasteSnapshot["lines"][number]>>;
  },
): CurrentRepasteSnapshot {
  const { lineExtras, ...rest } = extra ?? {};
  return {
    receiptId,
    status: rest.status ?? "needs_review",
    merchant: parsed.merchant,
    purchaseDate: parsed.purchaseDate,
    totalCents: parsed.totalCents,
    subtotalCents: parsed.subtotalCents,
    taxCents: parsed.taxCents,
    tipCents: parsed.tipCents,
    feeCents: parsed.feeCents,
    discountCents: parsed.discountCents,
    lines: parsed.items.map((item, index) => ({
      id: `line-${index + 1}`,
      sortIndex: index,
      displayDescription: item.description,
      sourceText: item.raw,
      totalCents: item.totalCents,
      quantity: item.quantity,
      ...(lineExtras?.[index] ?? {}),
    })),
    ...rest,
  };
}

const WALMART = parseHouseholdOsReceipt(PASTE_FIXTURE_WALMART_TRASH).receipt!;
const WALMART_CORRECTED = parseHouseholdOsReceipt(
  PASTE_FIXTURE_WALMART_TRASH_CORRECTED,
).receipt!;
const ALDI = parseHouseholdOsReceipt(PASTE_FIXTURE_ALDI_AUG20).receipt!;
const ALDI_CORRECTED = parseHouseholdOsReceipt(PASTE_FIXTURE_ALDI_AUG20_CORRECTED)
  .receipt!;

describe("re-paste line reconciliation", () => {
  it("1. no changes keeps the same line IDs", () => {
    const current = snapshotFromParsed("R1", WALMART);
    const matches = reconcileReceiptLines(current.lines, WALMART.items);
    expect(matches.every((m) => m.action === "keep" || m.action === "update")).toBe(true);
    expect(matches.map((m) => ("currentId" in m ? m.currentId : null))).toEqual([
      "line-1",
      "line-2",
    ]);
  });

  it("2. description-only ALDI correction keeps three logical lines and IDs", () => {
    const current = snapshotFromParsed("R1", ALDI);
    const incoming = ALDI_CORRECTED;
    const plan = buildRepastePlan(current, incoming);
    expect(plan.receiptId).toBe("R1");
    expect(plan.sameReceipt).toBe(true);
    expect(plan.lines).toHaveLength(6);
    expect(plan.lines.map((l) => l.currentId)).toEqual([
      "line-1",
      "line-2",
      "line-3",
      "line-4",
      "line-5",
      "line-6",
    ]);
    expect(plan.lines.map((l) => l.displayDescription).slice(0, 3)).toEqual([
      "85/15 Ground Beef",
      "French-Style Green Beans",
      "Yellow Onions, 3 lb Bag",
    ]);
    expect(plan.lines.every((l) => l.preserveClaims)).toBe(true);
    expect(plan.lines.every((l) => l.preserveAssignment)).toBe(true);
    expect(plan.descriptionOnly).toBe(true);
    expect(plan.notify).toBe(false);
  });

  it("3. price-only change keeps line ID and flags financial review", () => {
    const current = snapshotFromParsed("R1", ALDI);
    const beans = current.lines[1]!;
    const incoming = {
      ...ALDI,
      items: ALDI.items.map((item, i) =>
        i === 1 ? { ...item, totalCents: 618, raw: "French Green Beans | 6.18 | 2" } : item,
      ),
    };
    const plan = buildRepastePlan(current, incoming);
    const row = plan.lines.find((l) => l.currentId === beans.id);
    expect(row?.action).toBe("update");
    expect(row?.currentId).toBe("line-2");
    expect(row?.totalCents).toBe(618);
    expect(row?.financialReviewRequired).toBe(true);
    expect(row?.preserveAssignment).toBe(true);
    expect(plan.rows.some((r) => r.kind === "price_changed")).toBe(true);
  });

  it("4. quantity increase preserves claims and leaves remainder unclaimed", () => {
    const current = snapshotFromParsed("R1", ALDI, {
      lineExtras: ALDI.items.map((item, i) =>
        i === 1
          ? {
              claims: [{ membershipId: "andrew", quantity: 2, kind: "mine" as const, memberLabel: "Andrew" }],
            }
          : {},
      ),
    });
    const incoming = {
      ...ALDI,
      items: ALDI.items.map((item, i) =>
        i === 1
          ? {
              ...item,
              quantity: 3,
              totalCents: 897,
              raw: "French Green Beans | 8.97 | 3",
            }
          : item,
      ),
    };
    const plan = buildRepastePlan(current, incoming);
    const row = plan.lines.find((l) => l.currentId === "line-2");
    expect(row?.quantity).toBe(3);
    expect(row?.preserveClaims).toBe(true);
    expect(row?.remainingUnclaimed).toBe(1);
    expect(row?.claimReviewRequired).toBe(false);
  });

  it("5-6. quantity decrease below claims requires review and does not drop claims", () => {
    const current = snapshotFromParsed("R1", ALDI, {
      lineExtras: ALDI.items.map((item, i) =>
        i === 1
          ? {
              claims: [{ membershipId: "andrew", quantity: 2, kind: "mine" as const, memberLabel: "Andrew" }],
            }
          : {},
      ),
    });
    const incoming = {
      ...ALDI,
      items: ALDI.items.map((item, i) =>
        i === 1 ? { ...item, quantity: 1, totalCents: 299, raw: "French Green Beans | 2.99 | 1" } : item,
      ),
    };
    const plan = buildRepastePlan(current, incoming);
    const row = plan.lines.find((l) => l.currentId === "line-2");
    expect(row?.claimReviewRequired).toBe(true);
    expect(row?.claimedQuantityExceedsNew).toBe(true);
    expect(row?.preserveClaims).toBe(false);
    expect(row?.currentId).toBe("line-2");
  });

  it("7. added item is unassigned", () => {
    const current = snapshotFromParsed("R1", WALMART);
    const incoming = {
      ...WALMART,
      items: [
        ...WALMART.items,
        {
          ...WALMART.items[0]!,
          description: "Paper Towels",
          raw: "Paper Towels | 12.99 | 1",
          totalCents: 1299,
          quantity: 1,
        },
      ],
    };
    const plan = buildRepastePlan(current, incoming);
    const added = plan.lines.find((l) => l.action === "add");
    expect(added?.displayDescription).toBe("Paper Towels");
    expect(added?.preserveAssignment).toBe(false);
    expect(plan.rows.some((r) => r.kind === "item_added")).toBe(true);
  });

  it("8. unclaimed removed item can be removed", () => {
    const current = snapshotFromParsed("R1", WALMART);
    const incoming = {
      ...WALMART,
      items: [WALMART.items[0]!],
      subtotalCents: 3446,
      taxCents: 427,
      totalCents: 3873,
    };
    const plan = buildRepastePlan(current, incoming);
    const removed = plan.lines.find((l) => l.action === "remove");
    expect(removed?.currentId).toBe("line-2");
    expect(removed?.requiresRemovalConfirmation).toBe(false);
    expect(plan.applyBlockedReason).toBeNull();
  });

  it("9. claimed removed item requires explicit confirmation", () => {
    const current = snapshotFromParsed("R1", WALMART, {
      lineExtras: [
        {},
        {
          classification: "personal_other",
          participantMembershipIds: ["andrew"],
          claims: [{ membershipId: "andrew", quantity: 1, kind: "assigned", memberLabel: "Andrew" }],
        },
      ],
    });
    const incoming = {
      ...WALMART,
      items: [WALMART.items[0]!],
      subtotalCents: 3446,
      taxCents: 427,
      totalCents: 3873,
    };
    const blocked = buildRepastePlan(current, incoming);
    expect(blocked.applyBlockedReason).toMatch(/Andrew/);
    expect(blocked.claimedRemovals[0]?.name).toMatch(/Trash Bags/);
    const allowed = buildRepastePlan(current, incoming, {
      acceptedRemovedClaimLineIds: ["line-2"],
    });
    expect(allowed.applyBlockedReason).toBeNull();
    expect(allowed.canActivate).toBe(true);
  });

  it("10-13. merchant, date, tax, and total changes are classified in plain language", () => {
    const current = snapshotFromParsed("R1", WALMART);
    const incoming = {
      ...WALMART,
      merchant: "Target",
      purchaseDate: "2026-08-12",
      taxCents: 500,
      totalCents: 4911,
    };
    const plan = buildRepastePlan(current, incoming);
    expect(plan.rows.find((r) => r.kind === "merchant_changed")?.unchanged).toBe(false);
    expect(plan.rows.find((r) => r.kind === "date_changed")?.unchanged).toBe(false);
    expect(plan.rows.find((r) => r.kind === "tax_changed")?.unchanged).toBe(false);
    expect(plan.rows.find((r) => r.kind === "total_changed")?.unchanged).toBe(false);
    expect(REPASTE_CHANGE_LABELS.merchant_changed).toBe("Merchant changed");
    expect(REPASTE_CHANGE_LABELS.total_changed).toBe("Receipt total changed");
    expect(plan.financialChanged).toBe(true);
  });

  it("14. reconciliation failure does not activate the corrected revision", () => {
    const current = snapshotFromParsed("R1", WALMART);
    const incoming = {
      ...WALMART,
      totalCents: 9999,
      items: WALMART.items,
    };
    const plan = buildRepastePlan(current, incoming);
    expect(plan.reconciliation.balanced).toBe(false);
    expect(plan.reconciliation.copy).toMatch(/don't add up yet/i);
    expect(plan.canActivate).toBe(false);
    expect(plan.applyBlockedReason).toMatch(/don't add up yet/i);
  });

  it("15. user-edited description is kept by default", () => {
    const current = snapshotFromParsed("R1", WALMART, {
      lineExtras: [
        {
          displayDescription: "Boneless Skinless Chicken Thighs",
          descriptionEditedByUser: true,
        },
        {},
      ],
    });
    const incoming = {
      ...WALMART,
      items: [
        {
          ...WALMART.items[0]!,
          description: "FP B/S Chik Thighs",
          raw: "FP B/S Chik Thighs | 34.46 | 1",
        },
        WALMART.items[1]!,
      ],
    };
    const plan = buildRepastePlan(current, incoming);
    expect(plan.descriptionConflicts[0]?.currentName).toBe(
      "Boneless Skinless Chicken Thighs",
    );
    expect(plan.lines[0]?.displayDescription).toBe("Boneless Skinless Chicken Thighs");
    expect(plan.lines[0]?.preserveDescription).toBe(true);
    const used = buildRepastePlan(current, incoming, {
      descriptionChoices: { "line-1": "use_new" },
    });
    expect(used.lines[0]?.displayDescription).toBe("FP B/S Chik Thighs");
  });

  it("16. cancel is a no-op: building a plan does not mutate the snapshot", () => {
    const current = snapshotFromParsed("R1", WALMART);
    const before = structuredClone(current);
    buildRepastePlan(current, WALMART_CORRECTED);
    expect(current).toEqual(before);
  });

  it("17. restore previous version is a new plan against stored source text", () => {
    const current = snapshotFromParsed("R1", WALMART_CORRECTED);
    const plan = buildRepastePlan(current, WALMART);
    expect(plan.lines[0]?.displayDescription).toBe(
      "Mainstays 13.2-Gallon Step Trash Can",
    );
    expect(plan.lines[0]?.currentId).toBe("line-1");
  });

  it("20. finalized receipts cannot be re-pasted in place", () => {
    const current = snapshotFromParsed("R1", WALMART, { status: "confirmed" });
    const plan = buildRepastePlan(current, WALMART_CORRECTED);
    expect(plan.editable).toBe(false);
    expect(plan.finalized).toBe(true);
    expect(plan.canActivate).toBe(false);
    expect(plan.canStartCorrection).toBe(true);
    expect(plan.applyBlockedReason).toBeNull();
    expect(plan.confirmationCopy).toMatch(/starts a correction/i);
  });
});

describe("Walmart and ALDI correction fixtures", () => {
  it("Walmart trash-can re-paste keeps receipt and line IDs", () => {
    const current = snapshotFromParsed("R1", WALMART, {
      lineExtras: [
        {
          classification: "personal_purchaser",
          participantMembershipIds: ["atem"],
          claims: [{ membershipId: "atem", quantity: 1, kind: "mine", memberLabel: "Atem" }],
        },
        {
          classification: "personal_other",
          participantMembershipIds: ["andrew"],
          claims: [{ membershipId: "andrew", quantity: 1, kind: "assigned", memberLabel: "Andrew" }],
        },
      ],
    });
    const plan = buildRepastePlan(current, WALMART_CORRECTED);
    expect(plan.receiptId).toBe("R1");
    expect(plan.lines.map((l) => l.currentId)).toEqual(["line-1", "line-2"]);
    expect(plan.lines.map((l) => l.displayDescription)).toEqual([
      "Mainstays 13.2-Gallon Step Trash Can, Black",
      "Great Value 14.5-Gallon Trash Bags, 20 Count",
    ]);
    expect(plan.lines.every((l) => l.totalCents === (l.currentId === "line-1" ? 3446 : 998))).toBe(
      true,
    );
    expect(plan.lines.every((l) => l.preserveClaims)).toBe(true);
    expect(plan.lines.every((l) => l.preserveAssignment)).toBe(true);
    expect(plan.descriptionOnly).toBe(true);
    expect(plan.notify).toBe(false);
    expect(plan.canActivate).toBe(true);
  });

  it("ALDI description-only end-to-end keeps assignments", () => {
    const current = snapshotFromParsed("R1", ALDI, {
      lineExtras: ALDI.items.map((item, i) => {
        if (i === 0) {
          return {
            classification: "personal_purchaser",
            participantMembershipIds: ["atem"],
            claims: [{ membershipId: "atem", quantity: 1, kind: "mine" as const, memberLabel: "Atem" }],
          };
        }
        if (i === 1) {
          return {
            classification: "personal_other",
            participantMembershipIds: ["andrew"],
            claims: [
              { membershipId: "andrew", quantity: 2, kind: "assigned" as const, memberLabel: "Andrew" },
            ],
          };
        }
        return {};
      }),
    });
    const plan = buildRepastePlan(current, ALDI_CORRECTED);
    expect(plan.lines[0]?.currentId).toBe("line-1");
    expect(plan.lines[1]?.currentId).toBe("line-2");
    expect(plan.lines[1]?.displayDescription).toBe("French-Style Green Beans");
    expect(plan.lines[2]?.displayDescription).toBe("Yellow Onions, 3 lb Bag");
    expect(plan.lines[0]?.preserveClaims).toBe(true);
    expect(plan.lines[1]?.preserveClaims).toBe(true);
    expect(plan.descriptionOnly).toBe(true);
  });

  it("claiming receipts warn but remain editable", () => {
    const current = snapshotFromParsed("R1", WALMART, { status: "claiming" });
    const plan = buildRepastePlan(current, WALMART_CORRECTED);
    expect(plan.claimingActive).toBe(true);
    expect(plan.claimingWarning).toMatch(/claiming/i);
    expect(plan.editable).toBe(true);
  });
});

describe("re-paste copy", () => {
  it("uses human labels rather than internal terms", () => {
    expect(JSON.stringify(REPASTE_CHANGE_LABELS)).not.toMatch(/reconcil|payload|entity|remap/i);
    expect(REPASTE_CHANGE_LABELS.item_removed).toBe("This item was removed");
    expect(REPASTE_CHANGE_LABELS.item_added).toBe("This item was added");
  });
});
