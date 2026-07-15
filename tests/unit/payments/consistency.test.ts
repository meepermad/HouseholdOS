import { describe, expect, it } from "vitest";
import {
  computeObligationBalance,
  storedStatusAgreesWithDerived,
  storedStatusSyncedWithDerived,
} from "@/lib/payments";

describe("settlement consistency", () => {
  it("never produces negative official outstanding", () => {
    const overPaid = computeObligationBalance({
      originalAmountCents: 100,
      effectiveAmountCents: 100,
      confirmedPaidCents: 80,
      pendingPaymentCents: 0,
      waivedCents: 50,
    });
    expect(overPaid.officialOutstandingCents).toBe(0);
    expect(overPaid.officialOutstandingCents).toBeGreaterThanOrEqual(0);
  });

  it("does not treat confirmed payments as mutating effective amount", () => {
    const bal = computeObligationBalance({
      originalAmountCents: 500,
      effectiveAmountCents: 500,
      confirmedPaidCents: 500,
      pendingPaymentCents: 0,
      waivedCents: 0,
    });
    expect(bal.effectiveAmountCents).toBe(500);
    expect(bal.officialOutstandingCents).toBe(0);
    expect(bal.settlementState).toBe("settled");
  });

  it("stored status must not contradict derived balance state after sync", () => {
    const cases = [
      {
        storedStatus: "pending",
        settlementState: "unpaid" as const,
        officialOutstandingCents: 500,
        effectiveAmountCents: 500,
      },
      {
        storedStatus: "adjusted",
        settlementState: "partially_settled" as const,
        officialOutstandingCents: 200,
        effectiveAmountCents: 500,
      },
      {
        storedStatus: "settled",
        settlementState: "settled" as const,
        officialOutstandingCents: 0,
        effectiveAmountCents: 500,
      },
      {
        storedStatus: "waived",
        settlementState: "settled" as const,
        officialOutstandingCents: 0,
        effectiveAmountCents: 500,
      },
      {
        storedStatus: "reversed",
        settlementState: "reversed" as const,
        officialOutstandingCents: 0,
        effectiveAmountCents: 0,
      },
    ];

    for (const c of cases) {
      expect(storedStatusAgreesWithDerived(c)).toBe(true);
      expect(
        storedStatusSyncedWithDerived({
          storedStatus: c.storedStatus,
          settlementState: c.settlementState,
        }),
      ).toBe(true);
    }
  });

  it("flags impossible stored/derived pairs", () => {
    expect(
      storedStatusAgreesWithDerived({
        storedStatus: "pending",
        settlementState: "reversed",
        officialOutstandingCents: 0,
        effectiveAmountCents: 0,
      }),
    ).toBe(false);

    expect(
      storedStatusSyncedWithDerived({
        storedStatus: "pending",
        settlementState: "partially_settled",
      }),
    ).toBe(false);

    expect(
      storedStatusAgreesWithDerived({
        storedStatus: "settled",
        settlementState: "unpaid",
        officialOutstandingCents: 100,
        effectiveAmountCents: 100,
      }),
    ).toBe(false);
  });
});
