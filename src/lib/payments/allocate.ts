import { toCents } from "@/lib/money";
import {
  MAX_PAYMENT_CENTS,
  PaymentCalcError,
  type AllocationLine,
  type ObligationForAllocation,
} from "@/lib/payments/types";

function assertSafeCents(amount: number, label: string): void {
  if (!Number.isInteger(amount)) {
    throw new PaymentCalcError("unsafe_integer", `${label} must be an integer`);
  }
  if (Math.abs(amount) > MAX_PAYMENT_CENTS) {
    throw new PaymentCalcError(
      "unsafe_integer",
      `${label} exceeds safe integer limit`,
    );
  }
}

/** Oldest outstanding first; tie-break by createdAt then UUID. */
export function sortObligationsOldestFirst(
  obligations: readonly ObligationForAllocation[],
): ObligationForAllocation[] {
  return [...obligations].sort((a, b) => {
    const t = a.createdAt.localeCompare(b.createdAt);
    if (t !== 0) return t;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Suggest allocations for a payment amount using oldest-first fill.
 * Caller must review before submit; does not require exact full settlement.
 */
export function suggestOldestFirstAllocation(params: {
  paymentAmountCents: number;
  obligations: readonly ObligationForAllocation[];
  senderMembershipId: string;
  recipientMembershipId: string;
  householdId: string;
  currency: string;
}): AllocationLine[] {
  const {
    paymentAmountCents,
    senderMembershipId,
    recipientMembershipId,
    householdId,
    currency,
  } = params;

  assertSafeCents(paymentAmountCents, "payment amount");
  if (paymentAmountCents <= 0) {
    throw new PaymentCalcError(
      "invalid_payment_amount",
      "Payment amount must be positive",
    );
  }

  validatePairContext(
    params.obligations,
    senderMembershipId,
    recipientMembershipId,
    householdId,
    currency,
  );

  const ordered = sortObligationsOldestFirst(params.obligations).filter(
    (o) => o.officialOutstandingCents > 0,
  );

  let remaining = paymentAmountCents;
  const lines: AllocationLine[] = [];

  for (const o of ordered) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, o.officialOutstandingCents);
    if (take <= 0) continue;
    lines.push({ obligationId: o.id, amountCents: take });
    remaining -= take;
  }

  if (remaining > 0) {
    throw new PaymentCalcError(
      "payment_greater_than_outstanding",
      "Payment amount exceeds selected outstanding balances",
    );
  }

  return lines;
}

export function validateAllocations(params: {
  paymentAmountCents: number;
  allocations: readonly AllocationLine[];
  obligations: readonly ObligationForAllocation[];
  senderMembershipId: string;
  recipientMembershipId: string;
  householdId: string;
  currency: string;
}): void {
  const {
    paymentAmountCents,
    allocations,
    senderMembershipId,
    recipientMembershipId,
    householdId,
    currency,
  } = params;

  assertSafeCents(paymentAmountCents, "payment amount");
  if (paymentAmountCents <= 0) {
    throw new PaymentCalcError(
      "invalid_payment_amount",
      "Payment amount must be positive",
    );
  }

  if (allocations.length === 0) {
    throw new PaymentCalcError(
      "no_obligations_selected",
      "At least one obligation allocation is required",
    );
  }

  validatePairContext(
    params.obligations,
    senderMembershipId,
    recipientMembershipId,
    householdId,
    currency,
  );

  const byId = new Map(params.obligations.map((o) => [o.id, o]));
  const seen = new Set<string>();
  let sum = 0;

  for (const line of allocations) {
    assertSafeCents(line.amountCents, "allocation amount");
    if (line.amountCents <= 0) {
      throw new PaymentCalcError(
        "invalid_payment_amount",
        "Each allocation must be greater than zero",
      );
    }
    if (seen.has(line.obligationId)) {
      throw new PaymentCalcError(
        "duplicate_obligation_allocation",
        "Duplicate obligation in allocations",
      );
    }
    seen.add(line.obligationId);

    const o = byId.get(line.obligationId);
    if (!o) {
      throw new PaymentCalcError(
        "no_obligations_selected",
        "Allocation references an unknown obligation",
      );
    }
    if (line.amountCents > o.officialOutstandingCents) {
      throw new PaymentCalcError(
        "allocation_exceeds_outstanding",
        "Allocation exceeds obligation outstanding amount",
      );
    }
    sum += line.amountCents;
  }

  toCents(sum);
  if (sum !== paymentAmountCents) {
    throw new PaymentCalcError(
      "allocation_sum_mismatch",
      "Allocation sum must equal payment total",
    );
  }
}

function validatePairContext(
  obligations: readonly ObligationForAllocation[],
  senderMembershipId: string,
  recipientMembershipId: string,
  householdId: string,
  currency: string,
): void {
  if (senderMembershipId === recipientMembershipId) {
    throw new PaymentCalcError(
      "invalid_recipient",
      "Sender and recipient must differ",
    );
  }

  for (const o of obligations) {
    if (o.householdId !== householdId) {
      throw new PaymentCalcError(
        "cross_household_allocation",
        "Obligation belongs to another household",
      );
    }
    if (o.currency !== currency) {
      throw new PaymentCalcError(
        "currency_mismatch",
        "Obligation currency does not match payment",
      );
    }
    if (o.debtorMembershipId !== senderMembershipId) {
      throw new PaymentCalcError(
        "invalid_recipient",
        "Obligation debtor must be the payment sender",
      );
    }
    if (o.creditorMembershipId !== recipientMembershipId) {
      throw new PaymentCalcError(
        "cross_recipient_allocation",
        "All obligations must share the same recipient creditor",
      );
    }
  }
}
