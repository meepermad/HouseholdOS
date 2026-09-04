import { describe, expect, it } from "vitest";
import { previewReceiptSplit } from "@/lib/receipts/split-preview";

const payer = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";

describe("previewReceiptSplit equal-selected", () => {
  it("splits the whole receipt between the selected people", () => {
    const preview = previewReceiptSplit({
      merchant: "Target",
      payerMembershipId: payer,
      eligibleMembershipIds: [payer, other],
      declaredTotalCents: 1000,
      taxCents: null,
      tipCents: null,
      lines: [],
      splitEverything: { membershipIds: [other] },
    });
    const row = preview.members.find((m) => m.membershipId === other);
    expect(row?.totalCents).toBe(1000);
    expect(row?.owesPayerCents).toBe(1000);
  });

  it("does not throw when nobody is selected yet", () => {
    expect(() =>
      previewReceiptSplit({
        merchant: "Target",
        payerMembershipId: payer,
        eligibleMembershipIds: [payer, other],
        declaredTotalCents: 1000,
        taxCents: null,
        tipCents: null,
        lines: [],
        splitEverything: { membershipIds: [] },
      }),
    ).not.toThrow();
  });
});
