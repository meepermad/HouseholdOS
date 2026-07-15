/** Payment settlement types. All money values are integer cents. */

export const EXTERNAL_PAYMENT_METHODS = [
  "venmo",
  "zelle",
  "cash",
  "apple_cash",
  "paypal",
  "bank_transfer",
  "check",
  "other",
] as const;

export type ExternalPaymentMethod = (typeof EXTERNAL_PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = [
  "draft",
  "submitted",
  "confirmed",
  "rejected",
  "cancelled",
  "reversed",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type SettlementState =
  | "unpaid"
  | "partially_settled"
  | "settled"
  | "reversed";

/** Max absolute cents for a single payment/allocation (≈ $10M). */
export const MAX_PAYMENT_CENTS = 1_000_000_000;

export type ObligationForAllocation = {
  id: string;
  householdId: string;
  debtorMembershipId: string;
  creditorMembershipId: string;
  currency: string;
  /** Effective amount after expense corrections (`current_amount_cents`). */
  effectiveAmountCents: number;
  /** Official outstanding before this payment (ledger-derived). */
  officialOutstandingCents: number;
  createdAt: string;
};

export type AllocationLine = {
  obligationId: string;
  amountCents: number;
};

export type ObligationBalanceInput = {
  originalAmountCents: number;
  effectiveAmountCents: number;
  confirmedPaidCents: number;
  pendingPaymentCents: number;
  waivedCents: number;
  /** Expense-invalidated obligations (void/amend reverse). */
  isReversed?: boolean;
};

export type ObligationBalance = {
  originalAmountCents: number;
  effectiveAmountCents: number;
  confirmedPaidCents: number;
  pendingPaymentCents: number;
  waivedCents: number;
  officialOutstandingCents: number;
  projectedOutstandingCents: number;
  settlementState: SettlementState;
};

export type MemberBalanceSummary = {
  officialYouOweCents: number;
  officialYouAreOwedCents: number;
  officialNetCents: number;
  pendingOutgoingCents: number;
  pendingIncomingCents: number;
  projectedYouOweCents: number;
  projectedYouAreOwedCents: number;
};

export type PairwiseBalance = {
  counterpartyMembershipId: string;
  /** Positive = you owe them; negative = they owe you. */
  officialNetCents: number;
  pendingOutgoingCents: number;
  pendingIncomingCents: number;
};

export type AmendmentAfterPaymentCase = {
  effectiveBeforeCents: number;
  confirmedPaidCents: number;
  waivedCents: number;
  /** New intended effective amount for this party pair (0 if voided). */
  newEffectiveCents: number;
};

export type AmendmentAfterPaymentResult = {
  /** Effective amount to store on the original obligation. */
  originalEffectiveCents: number;
  /** Amount still owed on original (or successor delta for increases). */
  remainingObligationCents: number;
  /** Refund owed back to the overpaying debtor (creditor becomes debtor). */
  refundObligationCents: number;
};

export type PaymentCalcErrorCode =
  | "invalid_payment_amount"
  | "no_obligations_selected"
  | "allocation_sum_mismatch"
  | "allocation_exceeds_outstanding"
  | "invalid_recipient"
  | "cross_recipient_allocation"
  | "cross_household_allocation"
  | "currency_mismatch"
  | "payment_greater_than_outstanding"
  | "unsafe_integer"
  | "invalid_waiver_amount"
  | "duplicate_obligation_allocation";

export class PaymentCalcError extends Error {
  readonly code: PaymentCalcErrorCode;

  constructor(code: PaymentCalcErrorCode, message: string) {
    super(message);
    this.name = "PaymentCalcError";
    this.code = code;
  }
}
