/**
 * Plain-language status copy for roommate-facing UI.
 * Internal enum values stay in data attributes and logs only.
 */

import { humanizeEnum } from "./enums";

export type StatusExplanation = {
  label: string;
  detail?: string;
};

const EXPENSE_STATUS: Record<string, StatusExplanation> = {
  draft: {
    label: "Draft",
    detail: "Still being edited. Nothing is owed yet.",
  },
  ready_for_review: {
    label: "Waiting for confirmation",
    detail: "Check the split, then confirm or ask a question.",
  },
  confirmed: {
    label: "Confirmed",
    detail: "This purchase is part of household balances.",
  },
  amended: {
    label: "Updated",
    detail: "A correction replaced the original record.",
  },
  voided: {
    label: "Cancelled",
    detail: "This purchase no longer counts toward balances.",
  },
};

const PAYMENT_STATUS: Record<string, StatusExplanation> = {
  submitted: {
    label: "Waiting for confirmation",
    detail: "The recipient still needs to confirm they received this.",
  },
  confirmed: {
    label: "Confirmed",
    detail: "The recipient confirmed they received this payment.",
  },
  rejected: {
    label: "Not received",
    detail: "The recipient said they did not get this payment.",
  },
  cancelled: {
    label: "Cancelled",
    detail: "This payment record was withdrawn.",
  },
  reversed: {
    label: "Reversed",
    detail: "A confirmed payment was undone.",
  },
};

const SETTLEMENT_STATUS: Record<string, StatusExplanation> = {
  unpaid: {
    label: "Unpaid",
    detail: "This balance is still outstanding.",
  },
  partially_settled: {
    label: "Partially paid",
    detail: "Some of this balance has been paid.",
  },
  settled: {
    label: "Paid",
    detail: "This balance is settled.",
  },
};

const DISPUTE_STATUS: Record<string, StatusExplanation> = {
  open: {
    label: "Open",
    detail: "Someone asked to review this money record.",
  },
  under_review: {
    label: "Under review",
    detail: "The household is working through this disagreement.",
  },
  resolved: {
    label: "Resolved",
    detail: "The disagreement is closed.",
  },
  withdrawn: {
    label: "Withdrawn",
    detail: "The question was withdrawn.",
  },
};

const OPENING_BALANCE_STATUS: Record<string, StatusExplanation> = {
  awaiting_confirmation: {
    label: "Waiting for confirmation",
    detail: "Both people still need to agree this starting balance is right.",
  },
  confirmed: {
    label: "Confirmed",
    detail: "This starting balance is part of household totals.",
  },
  rejected: {
    label: "Rejected",
    detail: "Someone disagreed with this starting balance.",
  },
  cancelled: {
    label: "Cancelled",
    detail: "This starting balance was withdrawn.",
  },
};

const ROUTED_STATUS: Record<string, StatusExplanation> = {
  awaiting_intermediary_approval: {
    label: "Waiting for a roommate to approve",
    detail: "Someone in the middle still needs to accept this settlement.",
  },
  awaiting_acceptance: {
    label: "Waiting for acceptance",
    detail: "The suggested settlement has not been accepted yet.",
  },
  ready_to_pay: {
    label: "Ready to pay",
    detail: "Record the outside payment when you send it.",
  },
  awaiting_confirmation: {
    label: "Waiting for confirmation",
    detail: "The recipient still needs to confirm they were paid.",
  },
  confirmed: {
    label: "Confirmed",
    detail: "This settlement is complete.",
  },
  cancelled: {
    label: "Cancelled",
    detail: "This suggested settlement was withdrawn.",
  },
  stale: {
    label: "Out of date",
    detail: "Balances changed. Review a new suggestion.",
  },
};

const RECEIPT_STATUS: Record<string, StatusExplanation> = {
  uploaded: { label: "Reading receipt" },
  extracting: { label: "Reading receipt" },
  needs_review: { label: "Needs review" },
  claiming: { label: "Waiting for roommates to claim items" },
  ready_for_review: { label: "Ready to submit" },
  confirmed: { label: "Submitted" },
  failed: { label: "Could not read automatically" },
  rejected: { label: "Discarded" },
};

const CHORE_OCCURRENCE_STATUS: Record<string, StatusExplanation> = {
  scheduled: { label: "Scheduled" },
  in_progress: { label: "In progress" },
  completed: { label: "Done" },
  blocked: { label: "Blocked" },
  skipped: { label: "Skipped" },
  cancelled: { label: "Cancelled" },
  awaiting_verification: { label: "Waiting for a check" },
  verified: { label: "Checked" },
  reopened: { label: "Reopened" },
};

const NOTIFICATION_STATUS: Record<string, StatusExplanation> = {
  failed_delivery: {
    label: "Could not send notification",
    detail: "We will try again, or you can open HouseholdOS to review it.",
  },
};

const ONBOARDING_STATUS: Record<string, StatusExplanation> = {
  pending: { label: "Not finished yet" },
  in_progress: { label: "In progress" },
  completed: { label: "Finished" },
  skipped: { label: "Skipped" },
};

function lookup(
  table: Record<string, StatusExplanation>,
  status: string,
): StatusExplanation {
  return table[status] ?? { label: humanizeEnum(status) };
}

export function expenseStatusCopy(status: string): StatusExplanation {
  return lookup(EXPENSE_STATUS, status);
}

export function paymentStatusCopy(status: string): StatusExplanation {
  return lookup(PAYMENT_STATUS, status);
}

export function settlementStatusCopy(status: string): StatusExplanation {
  return lookup(SETTLEMENT_STATUS, status);
}

export function disputeStatusCopy(status: string): StatusExplanation {
  return lookup(DISPUTE_STATUS, status);
}

export function openingBalanceStatusCopy(status: string): StatusExplanation {
  return lookup(OPENING_BALANCE_STATUS, status);
}

export function routedSettlementStatusCopy(status: string): StatusExplanation {
  return lookup(ROUTED_STATUS, status);
}

export function receiptStatusCopy(status: string): StatusExplanation {
  return lookup(RECEIPT_STATUS, status);
}

export function choreOccurrenceStatusCopy(status: string): StatusExplanation {
  return lookup(CHORE_OCCURRENCE_STATUS, status);
}

export function onboardingStatusCopy(status: string): StatusExplanation {
  return lookup(ONBOARDING_STATUS, status);
}

/** Compact badge label. Never returns a raw enum string. */
export function humanStatusLabel(status: string): string {
  return (
    EXPENSE_STATUS[status] ??
    PAYMENT_STATUS[status] ??
    SETTLEMENT_STATUS[status] ??
    DISPUTE_STATUS[status] ??
    OPENING_BALANCE_STATUS[status] ??
    ROUTED_STATUS[status] ??
    RECEIPT_STATUS[status] ??
    CHORE_OCCURRENCE_STATUS[status] ??
    NOTIFICATION_STATUS[status] ??
    ONBOARDING_STATUS[status] ?? { label: humanizeEnum(status) }
  ).label;
}

export function expenseWaitingCopy(params: {
  status: string;
  isPayer: boolean;
  payerLabel: string;
}): string {
  if (params.status === "ready_for_review") {
    return params.isPayer
      ? "Waiting for your roommates to confirm."
      : `Waiting for you to confirm ${params.payerLabel}'s purchase.`;
  }
  return expenseStatusCopy(params.status).detail ?? expenseStatusCopy(params.status).label;
}

export function paymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    venmo: "Venmo",
    zelle: "Zelle",
    paypal: "PayPal",
    cash: "Cash",
    bank_transfer: "Bank transfer",
    cash_app: "Cash App",
    apple_cash: "Apple Cash",
    check: "Check",
    other: "Other",
  };
  return labels[method] ?? humanizeEnum(method);
}

export function timeOfDayGreeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
