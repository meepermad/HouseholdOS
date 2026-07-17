import { describe, expect, it } from "vitest";
import {
  isEligibleRoutedTriple,
  maxRoutableCents,
  suggestRoutedSettlements,
  type DirectedObligationEdge,
} from "@/lib/payments/routed-suggestions";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const O1 = "11111111-1111-1111-1111-111111111111";
const O2 = "22222222-2222-2222-2222-222222222222";
const O3 = "33333333-3333-3333-3333-333333333333";

describe("routed-suggestions", () => {
  it("computes max routable as min of both legs", () => {
    expect(maxRoutableCents(500, 300)).toBe(300);
    expect(maxRoutableCents(0, 300)).toBe(0);
  });

  it("suggests A→B→C routes ranked by amount then stable ids", () => {
    const edges: DirectedObligationEdge[] = [
      {
        obligationId: O1,
        debtorMembershipId: A,
        creditorMembershipId: B,
        availableCents: 4000,
        currency: "USD",
      },
      {
        obligationId: O2,
        debtorMembershipId: B,
        creditorMembershipId: C,
        availableCents: 2500,
        currency: "USD",
      },
      {
        obligationId: O3,
        debtorMembershipId: A,
        creditorMembershipId: C,
        availableCents: 1000,
        currency: "USD",
      },
    ];
    const suggestions = suggestRoutedSettlements(edges);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      payerMembershipId: A,
      intermediaryMembershipId: B,
      recipientMembershipId: C,
      amountCents: 2500,
      beforeEdges: { ab: 4000, bc: 2500 },
      afterEdges: { ab: 1500, bc: 0 },
    });
  });

  it("rejects ineligible triples", () => {
    expect(
      isEligibleRoutedTriple({
        payerId: A,
        intermediaryId: B,
        recipientId: C,
        abAvailable: 100,
        bcAvailable: 50,
        amountCents: 50,
        sameCurrency: true,
        disputed: false,
      }).ok,
    ).toBe(true);
    expect(
      isEligibleRoutedTriple({
        payerId: A,
        intermediaryId: A,
        recipientId: C,
        abAvailable: 100,
        bcAvailable: 50,
        amountCents: 50,
        sameCurrency: true,
        disputed: false,
      }),
    ).toEqual({ ok: false, reason: "parties_not_distinct" });
    expect(
      isEligibleRoutedTriple({
        payerId: A,
        intermediaryId: B,
        recipientId: C,
        abAvailable: 100,
        bcAvailable: 50,
        amountCents: 80,
        sameCurrency: true,
        disputed: false,
      }),
    ).toEqual({ ok: false, reason: "exceeds_available" });
  });
});
