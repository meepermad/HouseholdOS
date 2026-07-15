import {
  PaymentCalcError,
  type MemberBalanceSummary,
  type ObligationBalance,
  type ObligationBalanceInput,
  type PairwiseBalance,
} from "@/lib/payments/types";
import { deriveSettlementState } from "@/lib/payments/settlement-state";

function assertNonNegInt(n: number, label: string): void {
  if (!Number.isInteger(n) || n < 0) {
    throw new PaymentCalcError(
      "unsafe_integer",
      `${label} must be a non-negative integer`,
    );
  }
}

/**
 * Derive official/projected outstanding from ledger components.
 * Reversed payments and waived reversals must already be excluded from confirmed/waived inputs.
 */
export function computeObligationBalance(
  input: ObligationBalanceInput,
): ObligationBalance {
  const {
    originalAmountCents,
    effectiveAmountCents,
    confirmedPaidCents,
    pendingPaymentCents,
    waivedCents,
    isReversed = false,
  } = input;

  assertNonNegInt(originalAmountCents, "originalAmountCents");
  assertNonNegInt(effectiveAmountCents, "effectiveAmountCents");
  assertNonNegInt(confirmedPaidCents, "confirmedPaidCents");
  assertNonNegInt(pendingPaymentCents, "pendingPaymentCents");
  assertNonNegInt(waivedCents, "waivedCents");

  if (isReversed || effectiveAmountCents === 0) {
    return {
      originalAmountCents,
      effectiveAmountCents: isReversed ? 0 : effectiveAmountCents,
      confirmedPaidCents,
      pendingPaymentCents,
      waivedCents,
      officialOutstandingCents: 0,
      projectedOutstandingCents: 0,
      settlementState: isReversed
        ? "reversed"
        : deriveSettlementState({
            effectiveAmountCents,
            officialOutstandingCents: 0,
            isReversed: false,
          }),
    };
  }

  const officialOutstandingCents = Math.max(
    0,
    effectiveAmountCents - confirmedPaidCents - waivedCents,
  );
  const projectedOutstandingCents = Math.max(
    0,
    officialOutstandingCents - pendingPaymentCents,
  );

  return {
    originalAmountCents,
    effectiveAmountCents,
    confirmedPaidCents,
    pendingPaymentCents,
    waivedCents,
    officialOutstandingCents,
    projectedOutstandingCents,
    settlementState: deriveSettlementState({
      effectiveAmountCents,
      officialOutstandingCents,
      isReversed: false,
    }),
  };
}

export function computeMemberBalanceSummary(params: {
  /** Official outstanding where membership is debtor. */
  officialOwedByMe: readonly number[];
  /** Official outstanding where membership is creditor. */
  officialOwedToMe: readonly number[];
  /** Submitted outgoing allocation totals. */
  pendingOutgoing: readonly number[];
  /** Submitted incoming allocation totals. */
  pendingIncoming: readonly number[];
}): MemberBalanceSummary {
  const sum = (xs: readonly number[]) =>
    xs.reduce((a, b) => {
      assertNonNegInt(b, "balance component");
      return a + b;
    }, 0);

  const officialYouOweCents = sum(params.officialOwedByMe);
  const officialYouAreOwedCents = sum(params.officialOwedToMe);
  const pendingOutgoingCents = sum(params.pendingOutgoing);
  const pendingIncomingCents = sum(params.pendingIncoming);

  return {
    officialYouOweCents,
    officialYouAreOwedCents,
    officialNetCents: officialYouAreOwedCents - officialYouOweCents,
    pendingOutgoingCents,
    pendingIncomingCents,
    projectedYouOweCents: Math.max(
      0,
      officialYouOweCents - pendingOutgoingCents,
    ),
    projectedYouAreOwedCents: Math.max(
      0,
      officialYouAreOwedCents - pendingIncomingCents,
    ),
  };
}

/**
 * Pairwise official net without third-party simplification.
 * Positive netMeans you owe the counterparty.
 */
export function computePairwiseBalances(
  rows: readonly {
    counterpartyMembershipId: string;
    iOweThemOfficialCents: number;
    theyOweMeOfficialCents: number;
    pendingOutgoingCents: number;
    pendingIncomingCents: number;
  }[],
): PairwiseBalance[] {
  return rows
    .map((r) => {
      assertNonNegInt(r.iOweThemOfficialCents, "iOweThemOfficialCents");
      assertNonNegInt(r.theyOweMeOfficialCents, "theyOweMeOfficialCents");
      assertNonNegInt(r.pendingOutgoingCents, "pendingOutgoingCents");
      assertNonNegInt(r.pendingIncomingCents, "pendingIncomingCents");
      return {
        counterpartyMembershipId: r.counterpartyMembershipId,
        officialNetCents: r.iOweThemOfficialCents - r.theyOweMeOfficialCents,
        pendingOutgoingCents: r.pendingOutgoingCents,
        pendingIncomingCents: r.pendingIncomingCents,
      };
    })
    .filter(
      (r) =>
        r.officialNetCents !== 0 ||
        r.pendingOutgoingCents !== 0 ||
        r.pendingIncomingCents !== 0,
    )
    .sort((a, b) =>
      a.counterpartyMembershipId.localeCompare(b.counterpartyMembershipId),
    );
}

/** Amount available for a new waiver (cannot exceed official outstanding). */
export function maxWaiverCents(balance: ObligationBalance): number {
  return balance.officialOutstandingCents;
}

export function validateWaiverAmount(
  amountCents: number,
  officialOutstandingCents: number,
): void {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new PaymentCalcError(
      "invalid_waiver_amount",
      "Waiver amount must be a positive integer",
    );
  }
  if (amountCents > officialOutstandingCents) {
    throw new PaymentCalcError(
      "invalid_waiver_amount",
      "Waiver cannot exceed official outstanding",
    );
  }
}
