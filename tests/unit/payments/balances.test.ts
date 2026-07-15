import { describe, expect, it } from "vitest";
import {
  computeMemberBalanceSummary,
  computeObligationBalance,
  computePairwiseBalances,
  outstandingAfterPaymentReversal,
  PaymentCalcError,
  validateWaiverAmount,
} from "@/lib/payments";

function expectCode(fn: () => void, code: string) {
  try {
    fn();
    expect.fail("expected throw");
  } catch (e) {
    expect(e).toBeInstanceOf(PaymentCalcError);
    expect((e as PaymentCalcError).code).toBe(code);
  }
}

describe("obligation and member balances", () => {
  it("11. official versus projected balance", () => {
    const bal = computeObligationBalance({
      originalAmountCents: 4000,
      effectiveAmountCents: 4000,
      confirmedPaidCents: 0,
      pendingPaymentCents: 1500,
      waivedCents: 0,
    });
    expect(bal.officialOutstandingCents).toBe(4000);
    expect(bal.projectedOutstandingCents).toBe(2500);

    const member = computeMemberBalanceSummary({
      officialOwedByMe: [4000],
      officialOwedToMe: [0],
      pendingOutgoing: [1500],
      pendingIncoming: [0],
    });
    expect(member.officialYouOweCents).toBe(4000);
    expect(member.projectedYouOweCents).toBe(2500);
  });

  it("12. reversal restoring outstanding balance", () => {
    const before = computeObligationBalance({
      originalAmountCents: 3000,
      effectiveAmountCents: 3000,
      confirmedPaidCents: 3000,
      pendingPaymentCents: 0,
      waivedCents: 0,
    });
    expect(before.officialOutstandingCents).toBe(0);
    expect(before.settlementState).toBe("settled");

    const afterPaid = outstandingAfterPaymentReversal({
      effectiveAmountCents: 3000,
      confirmedPaidAfterReversalCents: 0,
      waivedCents: 0,
    });
    expect(afterPaid).toBe(3000);

    const after = computeObligationBalance({
      originalAmountCents: 3000,
      effectiveAmountCents: 3000,
      confirmedPaidCents: 0,
      pendingPaymentCents: 0,
      waivedCents: 0,
    });
    expect(after.officialOutstandingCents).toBe(3000);
    expect(after.settlementState).toBe("unpaid");
  });

  it("13. waiver reducing balance", () => {
    const bal = computeObligationBalance({
      originalAmountCents: 1000,
      effectiveAmountCents: 1000,
      confirmedPaidCents: 200,
      pendingPaymentCents: 0,
      waivedCents: 300,
    });
    expect(bal.officialOutstandingCents).toBe(500);
    expect(bal.effectiveAmountCents).toBe(1000);
  });

  it("14. waiver reversal", () => {
    const withWaiver = computeObligationBalance({
      originalAmountCents: 1000,
      effectiveAmountCents: 1000,
      confirmedPaidCents: 0,
      pendingPaymentCents: 0,
      waivedCents: 400,
    });
    expect(withWaiver.officialOutstandingCents).toBe(600);

    const afterReversal = computeObligationBalance({
      originalAmountCents: 1000,
      effectiveAmountCents: 1000,
      confirmedPaidCents: 0,
      pendingPaymentCents: 0,
      waivedCents: 0,
    });
    expect(afterReversal.officialOutstandingCents).toBe(1000);
  });

  it("15. derived partially settled state", () => {
    const bal = computeObligationBalance({
      originalAmountCents: 1000,
      effectiveAmountCents: 1000,
      confirmedPaidCents: 400,
      pendingPaymentCents: 0,
      waivedCents: 0,
    });
    expect(bal.settlementState).toBe("partially_settled");
  });

  it("16. derived settled state", () => {
    expect(
      computeObligationBalance({
        originalAmountCents: 1000,
        effectiveAmountCents: 1000,
        confirmedPaidCents: 600,
        pendingPaymentCents: 0,
        waivedCents: 400,
      }).settlementState,
    ).toBe("settled");
  });

  it("pairwise balances without third-party simplification", () => {
    const pairs = computePairwiseBalances([
      {
        counterpartyMembershipId: "m",
        iOweThemOfficialCents: 4215,
        theyOweMeOfficialCents: 0,
        pendingOutgoingCents: 0,
        pendingIncomingCents: 0,
      },
      {
        counterpartyMembershipId: "a",
        iOweThemOfficialCents: 0,
        theyOweMeOfficialCents: 1875,
        pendingOutgoingCents: 0,
        pendingIncomingCents: 500,
      },
    ]);
    expect(pairs).toHaveLength(2);
    expect(pairs[0]?.counterpartyMembershipId).toBe("a");
    expect(pairs[0]?.officialNetCents).toBe(-1875);
    expect(pairs[1]?.officialNetCents).toBe(4215);
  });

  it("invalid waiver amount", () => {
    expectCode(() => validateWaiverAmount(0, 100), "invalid_waiver_amount");
    expectCode(() => validateWaiverAmount(200, 100), "invalid_waiver_amount");
  });

  it("does not mutate effective amount when paid", () => {
    const bal = computeObligationBalance({
      originalAmountCents: 1225,
      effectiveAmountCents: 1225,
      confirmedPaidCents: 1225,
      pendingPaymentCents: 0,
      waivedCents: 0,
    });
    expect(bal.effectiveAmountCents).toBe(1225);
    expect(bal.officialOutstandingCents).toBe(0);
  });
});
