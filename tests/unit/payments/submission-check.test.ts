import { describe, expect, it } from "vitest";
import {
  allocationsMatch,
  reviewSettlementSubmission,
  type SubmissionObligation,
} from "@/lib/payments/submission-check";

const H = "hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh";
const DEBTOR = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const CREDITOR = "cccccccc-cccc-cccc-cccc-cccccccccccc";

function obligation(partial: Partial<SubmissionObligation> & { id: string }): SubmissionObligation {
  return {
    label: "Walmart",
    householdId: H,
    debtorMembershipId: DEBTOR,
    creditorMembershipId: CREDITOR,
    officialOutstandingCents: 5000,
    pendingPaymentCents: 0,
    storedStatus: "active",
    ...partial,
  };
}

describe("reviewSettlementSubmission", () => {
  it("rejects an empty selection", () => {
    const review = reviewSettlementSubmission({
      direction: "sent",
      actorMembershipId: DEBTOR,
      counterpartyMembershipId: CREDITOR,
      householdId: H,
      totalAmountCents: 100,
      allocations: [],
      obligations: [obligation({ id: "a" })],
    });
    expect(review.ok).toBe(false);
    if (!review.ok) expect(review.message).toMatch(/at least one expense/i);
  });

  it("accepts the exact submitted ids when they are still eligible", () => {
    const review = reviewSettlementSubmission({
      direction: "sent",
      actorMembershipId: DEBTOR,
      counterpartyMembershipId: CREDITOR,
      householdId: H,
      totalAmountCents: 3000,
      allocations: [
        { obligationId: "a", amountCents: 2000 },
        { obligationId: "b", amountCents: 1000 },
      ],
      obligations: [
        obligation({ id: "a", label: "Walmart", officialOutstandingCents: 2000 }),
        obligation({ id: "b", label: "ALDI", officialOutstandingCents: 1000 }),
      ],
    });
    expect(review).toMatchObject({ ok: true, ids: ["a", "b"] });
  });

  it("names the expense that is no longer open", () => {
    const review = reviewSettlementSubmission({
      direction: "received",
      actorMembershipId: CREDITOR,
      counterpartyMembershipId: DEBTOR,
      householdId: H,
      totalAmountCents: 1000,
      allocations: [{ obligationId: "b", amountCents: 1000 }],
      obligations: [
        obligation({
          id: "b",
          label: "Electricity",
          officialOutstandingCents: 0,
        }),
      ],
    });
    expect(review.ok).toBe(false);
    if (!review.ok) expect(review.message).toContain("Electricity");
  });

  it("matches duplicate allocation sets", () => {
    expect(
      allocationsMatch(
        [
          { obligationId: "b", amountCents: 10 },
          { obligationId: "a", amountCents: 20 },
        ],
        [
          { obligationId: "a", amountCents: 20 },
          { obligationId: "b", amountCents: 10 },
        ],
      ),
    ).toBe(true);
  });
});
