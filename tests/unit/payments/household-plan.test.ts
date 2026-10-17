import { describe, expect, it } from "vitest";
import { planHouseholdSettlement } from "@/lib/payments/household-plan";
import type { DirectedObligationEdge } from "@/lib/payments/routed-suggestions";
import { PaymentCalcError } from "@/lib/payments/types";

const ALEX = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const JORDAN = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const SAM = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const TAYLOR = "dddddddd-dddd-dddd-dddd-dddddddddddd";

const GROCERIES = "11111111-1111-1111-1111-111111111111";
const RENT = "22222222-2222-2222-2222-222222222222";
const TAYLOR_TO_JORDAN = "33333333-3333-3333-3333-333333333333";
const JORDAN_TO_TAYLOR = "44444444-4444-4444-4444-444444444444";

function edge(
  obligationId: string,
  debtorMembershipId: string,
  creditorMembershipId: string,
  availableCents: number,
): DirectedObligationEdge {
  return {
    obligationId,
    debtorMembershipId,
    creditorMembershipId,
    availableCents,
    currency: "USD",
  };
}

describe("planHouseholdSettlement", () => {
  it("turns a four-person tangle into three payments after the covered loop", () => {
    const plan = planHouseholdSettlement([
      edge(GROCERIES, ALEX, JORDAN, 4000),
      edge(RENT, SAM, ALEX, 3500),
      edge(TAYLOR_TO_JORDAN, TAYLOR, JORDAN, 800),
      edge(JORDAN_TO_TAYLOR, JORDAN, TAYLOR, 300),
    ]);

    expect(plan.offsets).toEqual([
      expect.objectContaining({
        amountCents: 300,
        currency: "USD",
        membershipIds: expect.arrayContaining([TAYLOR, JORDAN]),
      }),
    ]);
    expect(plan.offsets[0]?.legs.map((leg) => leg.obligationId).sort()).toEqual([
      TAYLOR_TO_JORDAN,
      JORDAN_TO_TAYLOR,
    ]);
    expect(plan.payments.map((payment) => ({
      payer: payment.payerMembershipId,
      recipient: payment.recipientMembershipId,
      amount: payment.amountCents,
      legs: payment.legs.map((leg) => [leg.obligationId, leg.amountCents]),
    }))).toEqual([
      {
        payer: SAM,
        recipient: JORDAN,
        amount: 3500,
        legs: [
          [GROCERIES, 3500],
          [RENT, 3500],
        ],
      },
      {
        payer: ALEX,
        recipient: JORDAN,
        amount: 500,
        legs: [[GROCERIES, 500]],
      },
      {
        payer: TAYLOR,
        recipient: JORDAN,
        amount: 500,
        legs: [[TAYLOR_TO_JORDAN, 500]],
      },
    ]);
  });

  it("shows one payment when only that net is still open", () => {
    const plan = planHouseholdSettlement([edge(GROCERIES, ALEX, JORDAN, 500)]);
    expect(plan.offsets).toEqual([]);
    expect(plan.payments).toEqual([
      expect.objectContaining({
        payerMembershipId: ALEX,
        recipientMembershipId: JORDAN,
        amountCents: 500,
      }),
    ]);
  });

  it("clears a covered pair without asking anyone to pay", () => {
    const plan = planHouseholdSettlement([
      edge(TAYLOR_TO_JORDAN, TAYLOR, JORDAN, 800),
      edge(JORDAN_TO_TAYLOR, JORDAN, TAYLOR, 800),
    ]);
    expect(plan.payments).toEqual([]);
    expect(plan.offsets).toHaveLength(1);
    expect(plan.offsets[0]?.amountCents).toBe(800);
  });

  it("pays along a chain so the middle person is not a stop", () => {
    const plan = planHouseholdSettlement([
      edge(RENT, SAM, ALEX, 1000),
      edge(GROCERIES, ALEX, JORDAN, 1000),
    ]);
    expect(plan.offsets).toEqual([]);
    expect(plan.payments).toEqual([
      expect.objectContaining({
        payerMembershipId: SAM,
        recipientMembershipId: JORDAN,
        amountCents: 1000,
      }),
    ]);
    expect(plan.payments[0]?.legs).toHaveLength(2);
  });

  it("keeps separate pairs on their own payments", () => {
    const plan = planHouseholdSettlement([
      edge(GROCERIES, ALEX, JORDAN, 1000),
      edge(RENT, SAM, TAYLOR, 1000),
    ]);
    expect(plan.offsets).toEqual([]);
    expect(plan.payments).toEqual([
      expect.objectContaining({
        payerMembershipId: ALEX,
        recipientMembershipId: JORDAN,
        amountCents: 1000,
      }),
      expect.objectContaining({
        payerMembershipId: SAM,
        recipientMembershipId: TAYLOR,
        amountCents: 1000,
      }),
    ]);
  });

  it("rejects duplicate obligations", () => {
    expect(() =>
      planHouseholdSettlement([
        edge(GROCERIES, ALEX, JORDAN, 100),
        edge(GROCERIES, SAM, TAYLOR, 100),
      ]),
    ).toThrow(PaymentCalcError);
  });
});
