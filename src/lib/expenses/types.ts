/** Expense allocation engine types. All money values are integer cents. */

export type ItemAllocationMode =
  | "personal"
  | "equal_all"
  | "equal_selected"
  | "fixed_cents"
  | "percentage"
  | "weighted"
  | "excluded";

export type AdjustmentType =
  | "tax"
  | "tip"
  | "delivery_fee"
  | "service_fee"
  | "discount"
  | "coupon"
  | "store_credit"
  | "other";

export type AdjustmentAllocationMode =
  | "proportional"
  | "equal_all"
  | "equal_selected"
  | "fixed_cents"
  | "percentage"
  | "weighted"
  | "payer_absorbs"
  | "assigned";

export type ExpenseCalcErrorCode =
  | "currency_mismatch"
  | "invalid_payer"
  | "invalid_allocation_target"
  | "incomplete_allocation"
  | "reconciliation_failure"
  | "invalid_negative_result"
  | "invalid_percentage_total"
  | "invalid_fixed_total"
  | "invalid_weights"
  | "empty_participants"
  | "zero_basis";

export class ExpenseCalcError extends Error {
  readonly code: ExpenseCalcErrorCode;

  constructor(code: ExpenseCalcErrorCode, message: string) {
    super(message);
    this.name = "ExpenseCalcError";
    this.code = code;
  }
}

/** Rational share used before integer rounding. */
export type RationalShare = {
  membershipId: string;
  /** Unrounded amount in cents as a rational (numerator/denominator over total). */
  exactCents: number;
};

export type MemberAllocationInput = {
  membershipId: string;
  /** Fixed cents (fixed_cents mode). */
  fixedCents?: number;
  /** Percentage in basis points of 100% = 10000, or use percent as 0–100 with cents precision via percentBps. */
  percentBps?: number;
  /** Positive integer weight (weighted mode). */
  weight?: number;
};

export type ExpenseItemInput = {
  id: string;
  description: string;
  totalCents: number;
  allocationMode: ItemAllocationMode;
  /** Required for personal mode. */
  personalMembershipId?: string;
  /** Participants for equal_selected / fixed / percentage / weighted. */
  participants?: MemberAllocationInput[];
  /**
   * When true (excluded lines only), do not add this line to the payer's
   * proportional adjustment basis.
   */
  excludeFromAdjustmentBasis?: boolean;
};

export type ExpenseAdjustmentInput = {
  id: string;
  description: string;
  type: AdjustmentType;
  /**
   * Signed amount in cents. Positive increases the expense total
   * (tax/tip/fees). Negative reduces it (discount/coupon/store credit).
   */
  amountCents: number;
  allocationMode: AdjustmentAllocationMode;
  participants?: MemberAllocationInput[];
  /** Required for assigned mode. */
  assignedMembershipId?: string;
};

export type CalculateExpenseInput = {
  payerMembershipId: string;
  /** All eligible active membership IDs (stable order not required). */
  eligibleMembershipIds: readonly string[];
  currency: string;
  householdCurrency: string;
  declaredTotalCents: number;
  items: ExpenseItemInput[];
  adjustments: ExpenseAdjustmentInput[];
};

export type MemberAmount = {
  membershipId: string;
  amountCents: number;
};

export type AllocatedLine = {
  sourceType: "item" | "adjustment";
  sourceId: string;
  description: string;
  totalCents: number;
  allocations: MemberAmount[];
  /** For excluded items: true when no reimbursement allocations were created. */
  excluded?: boolean;
};

export type MemberShareBreakdown = {
  membershipId: string;
  itemSubtotalCents: number;
  adjustmentCents: number;
  totalShareCents: number;
  lines: Array<{
    sourceType: "item" | "adjustment";
    sourceId: string;
    description: string;
    amountCents: number;
  }>;
};

export type ReimbursementObligationPreview = {
  debtorMembershipId: string;
  creditorMembershipId: string;
  amountCents: number;
  lines: Array<{
    sourceType: "item" | "adjustment";
    sourceId: string;
    description: string;
    amountCents: number;
  }>;
};

export type CalculateExpenseResult = {
  ok: true;
  itemSubtotalCents: number;
  adjustmentsNetCents: number;
  calculatedTotalCents: number;
  declaredTotalCents: number;
  reconciled: true;
  lines: AllocatedLine[];
  memberShares: MemberShareBreakdown[];
  /** Pre-adjustment per-member item basis used for proportional adjustments. */
  proportionalBasis: MemberAmount[];
  obligations: ReimbursementObligationPreview[];
};

export type CalculateExpenseFailure = {
  ok: false;
  code: ExpenseCalcErrorCode;
  message: string;
  reconciled: false;
  calculatedTotalCents?: number;
  declaredTotalCents?: number;
};
