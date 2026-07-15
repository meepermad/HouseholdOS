import { describe, expect, it } from "vitest";
import { planAmendmentAfterPayment } from "@/lib/payments";

describe("amendment and void after payment", () => {
  it("20. amendment increase after partial payment", () => {
    const result = planAmendmentAfterPayment({
      effectiveBeforeCents: 1000,
      confirmedPaidCents: 400,
      waivedCents: 0,
      newEffectiveCents: 1500,
    });
    expect(result.originalEffectiveCents).toBe(1000);
    expect(result.remainingObligationCents).toBe(500);
    expect(result.refundObligationCents).toBe(0);
    // Official outstanding on original stays 600; successor adds 500 unpaid.
  });

  it("21. amendment decrease after partial payment", () => {
    const result = planAmendmentAfterPayment({
      effectiveBeforeCents: 1000,
      confirmedPaidCents: 400,
      waivedCents: 0,
      newEffectiveCents: 700,
    });
    expect(result.originalEffectiveCents).toBe(700);
    expect(result.remainingObligationCents).toBe(300);
    expect(result.refundObligationCents).toBe(0);
  });

  it("22. reduction below amount paid creating refund obligation", () => {
    const result = planAmendmentAfterPayment({
      effectiveBeforeCents: 1000,
      confirmedPaidCents: 800,
      waivedCents: 0,
      newEffectiveCents: 500,
    });
    expect(result.originalEffectiveCents).toBe(500);
    expect(result.remainingObligationCents).toBe(0);
    expect(result.refundObligationCents).toBe(300);
  });

  it("23. void after full payment creating refund obligation", () => {
    const result = planAmendmentAfterPayment({
      effectiveBeforeCents: 2500,
      confirmedPaidCents: 2500,
      waivedCents: 0,
      newEffectiveCents: 0,
    });
    expect(result.originalEffectiveCents).toBe(0);
    expect(result.remainingObligationCents).toBe(0);
    expect(result.refundObligationCents).toBe(2500);
  });

  it("24. pending payment during amendment does not change plan inputs", () => {
    // Pending is excluded from confirmed; amendment math uses confirmed only.
    const result = planAmendmentAfterPayment({
      effectiveBeforeCents: 1000,
      confirmedPaidCents: 0,
      waivedCents: 0,
      newEffectiveCents: 800,
    });
    expect(result.originalEffectiveCents).toBe(800);
    expect(result.remainingObligationCents).toBe(800);
    expect(result.refundObligationCents).toBe(0);
  });

  it("unpaid amendment decrease", () => {
    const result = planAmendmentAfterPayment({
      effectiveBeforeCents: 1000,
      confirmedPaidCents: 0,
      waivedCents: 0,
      newEffectiveCents: 600,
    });
    expect(result.originalEffectiveCents).toBe(600);
    expect(result.remainingObligationCents).toBe(600);
    expect(result.refundObligationCents).toBe(0);
  });

  it("unpaid amendment increase", () => {
    const result = planAmendmentAfterPayment({
      effectiveBeforeCents: 1000,
      confirmedPaidCents: 0,
      waivedCents: 0,
      newEffectiveCents: 1400,
    });
    expect(result.originalEffectiveCents).toBe(1000);
    expect(result.remainingObligationCents).toBe(400);
    expect(result.refundObligationCents).toBe(0);
  });

  it("waivers reduce need for refund on decrease", () => {
    const result = planAmendmentAfterPayment({
      effectiveBeforeCents: 1000,
      confirmedPaidCents: 400,
      waivedCents: 300,
      newEffectiveCents: 500,
    });
    // confirmed 400 <= new 500 → no refund; outstanding 0 after waived covers rest conceptually
    expect(result.refundObligationCents).toBe(0);
    expect(result.remainingObligationCents).toBe(0);
    expect(result.originalEffectiveCents).toBe(500);
  });
});
