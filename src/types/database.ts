/**
 * Application database types.
 * Table/RPC shapes come from the generated Supabase dump; domain unions stay hand-authored.
 */
export type { Database, Json } from "./database.generated";

export type HouseholdResponsibility =
  | "member"
  | "household_coordinator"
  | "financial_coordinator";

export type MembershipStatus =
  | "invited"
  | "active"
  | "leaving"
  | "former"
  | "removed";

export type HouseholdStatus = "active" | "archived";

export type InvitationStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "revoked"
  | "expired";

export type OnboardingStatus = "pending" | "in_progress" | "complete";

export type ReimbursementPolicy = "external_reimbursement";
export type ApprovalRule = "threshold" | "always" | "never";

export type ExpenseStatus =
  | "draft"
  | "ready_for_review"
  | "confirmed"
  | "amended"
  | "voided";

export type ExpenseCategory =
  | "groceries"
  | "household"
  | "utilities"
  | "dining"
  | "transport"
  | "health"
  | "other";

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

export type ObligationStatus =
  | "pending"
  | "adjusted"
  | "reversed"
  | "waived"
  | "settled";

export type ExpenseRow = import("./database.generated").Database["public"]["Tables"]["expenses"]["Row"];
export type ExpenseItemRow =
  import("./database.generated").Database["public"]["Tables"]["expense_items"]["Row"];
export type ReimbursementObligationRow =
  import("./database.generated").Database["public"]["Tables"]["reimbursement_obligations"]["Row"];
