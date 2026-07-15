import {
  PaymentCalcError,
  type AmendmentAfterPaymentCase,
  type AmendmentAfterPaymentResult,
} from "@/lib/payments/types";

/**
 * Decide how an expense amendment/void affects a party-pair obligation that may
 * already have confirmed payments or waivers.
 *
 * Confirmed payments are never erased. Overpayment creates a refund obligation
 * (flipped debtor/creditor). Increases leave confirmed paid intact and expose
 * only the incremental unpaid amount via remainingObligationCents (successor).
 */
export function planAmendmentAfterPayment(
  input: AmendmentAfterPaymentCase,
): AmendmentAfterPaymentResult {
  const {
    effectiveBeforeCents,
    confirmedPaidCents,
    waivedCents,
    newEffectiveCents,
  } = input;

  for (const [label, n] of [
    ["effectiveBeforeCents", effectiveBeforeCents],
    ["confirmedPaidCents", confirmedPaidCents],
    ["waivedCents", waivedCents],
    ["newEffectiveCents", newEffectiveCents],
  ] as const) {
    if (!Number.isInteger(n) || n < 0) {
      throw new PaymentCalcError(
        "unsafe_integer",
        `${label} must be a non-negative integer`,
      );
    }
  }

  const settledCovered = confirmedPaidCents + waivedCents;

  // Void or full invalidation: original effective → 0; refund any confirmed pay.
  if (newEffectiveCents === 0) {
    return {
      originalEffectiveCents: 0,
      remainingObligationCents: 0,
      refundObligationCents: confirmedPaidCents,
    };
  }

  // Decrease (or unchanged) relative to prior effective.
  if (newEffectiveCents <= effectiveBeforeCents) {
    if (newEffectiveCents >= settledCovered) {
      // Still enough room for prior payments/waivers; outstanding shrinks.
      return {
        originalEffectiveCents: newEffectiveCents,
        remainingObligationCents: newEffectiveCents - settledCovered,
        refundObligationCents: 0,
      };
    }
    // Reduction below amount already paid (+ waived treated as reducing need to refund).
    // Refund only the confirmed payment overage beyond the new effective (waivers do not create refunds).
    const refund = Math.max(0, confirmedPaidCents - newEffectiveCents);
    return {
      originalEffectiveCents: newEffectiveCents,
      remainingObligationCents: 0,
      refundObligationCents: refund,
    };
  }

  // Increase: keep original at prior effective (payments stay attached); successor
  // carries the delta as a new unpaid obligation amount.
  const delta = newEffectiveCents - effectiveBeforeCents;
  return {
    originalEffectiveCents: effectiveBeforeCents,
    remainingObligationCents: delta,
    refundObligationCents: 0,
  };
}

/**
 * After a confirmed payment is reversed, confirmed_paid for that payment's
 * allocations should drop out of the ledger inputs. Official outstanding
 * reopens by recomputing balance — no mutation of effective amount.
 */
export function outstandingAfterPaymentReversal(params: {
  effectiveAmountCents: number;
  confirmedPaidAfterReversalCents: number;
  waivedCents: number;
}): number {
  return Math.max(
    0,
    params.effectiveAmountCents -
      params.confirmedPaidAfterReversalCents -
      params.waivedCents,
  );
}
