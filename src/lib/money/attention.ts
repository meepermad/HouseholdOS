/**
 * Financial attention queue: plain-language items with stable urgency ordering.
 */

export type AttentionUrgency =
  | 10 // dispute
  | 20 // payment confirm
  | 30 // payment sender
  | 40 // opening balance
  | 50 // routed approvals
  | 60 // receipt / expense drafts
  | 70 // failed receipt / utility / import
  | 80; // lower priority

export type AttentionItem = {
  id: string;
  urgency: AttentionUrgency;
  title: string;
  body: string;
  href: string;
  amountCents?: number;
  memberLabel?: string;
  ctaLabel: string;
};

export function sortAttentionItems(items: readonly AttentionItem[]): AttentionItem[] {
  return [...items].sort((a, b) => {
    if (a.urgency !== b.urgency) return a.urgency - b.urgency;
    return a.id.localeCompare(b.id);
  });
}

export function formatPaymentConfirmAttention(params: {
  paymentId: string;
  amountCents: number;
  senderLabel: string;
  householdId: string;
}): AttentionItem {
  return {
    id: `payment-confirm-${params.paymentId}`,
    urgency: 20,
    title: `${params.senderLabel} recorded a payment to you.`,
    body: `Confirm that you received ${formatCentsPlain(params.amountCents)}.`,
    href: `/app/${params.householdId}/money/payments/${params.paymentId}`,
    amountCents: params.amountCents,
    memberLabel: params.senderLabel,
    ctaLabel: "Review payment",
  };
}

export function formatDisputeAttention(params: {
  disputeId: string;
  householdId: string;
}): AttentionItem {
  return {
    id: `dispute-${params.disputeId}`,
    urgency: 10,
    title: "A reimbursement dispute needs a response.",
    body: "Review the dispute and confirm or resolve it with your roommate.",
    href: `/app/${params.householdId}/money/disputes/${params.disputeId}`,
    ctaLabel: "Review dispute",
  };
}

export function formatReceiptDraftAttention(params: {
  count: number;
  householdId: string;
}): AttentionItem {
  const n = params.count;
  return {
    id: "receipt-drafts",
    urgency: 60,
    title: n === 1 ? "One receipt is ready to review." : `${n} receipts are ready to review.`,
    body: "Finish the review to create or update an expense.",
    href: `/app/${params.householdId}/money/receipts`,
    ctaLabel: n === 1 ? "Review receipt" : "Review receipts",
  };
}

export function formatExpenseDraftAttention(params: {
  expenseId: string;
  merchant: string;
  householdId: string;
}): AttentionItem {
  return {
    id: `expense-draft-${params.expenseId}`,
    urgency: 60,
    title: "An expense draft still needs completion.",
    body: params.merchant
      ? `Finish “${params.merchant}” so roommates can confirm the split.`
      : "Finish the draft so roommates can confirm the split.",
    href: `/app/${params.householdId}/money/expenses/${params.expenseId}/edit`,
    ctaLabel: "Continue draft",
  };
}

export function formatExpenseReviewAttention(params: {
  expenseId: string;
  merchant: string;
  householdId: string;
}): AttentionItem {
  return {
    id: `expense-review-${params.expenseId}`,
    urgency: 60,
    title: "An expense is waiting for confirmation.",
    body: params.merchant
      ? `Confirm the split for “${params.merchant}”.`
      : "Confirm the expense split.",
    href: `/app/${params.householdId}/money/expenses/${params.expenseId}`,
    ctaLabel: "Review expense",
  };
}

export function formatOpeningBalanceAttention(params: {
  entryId: string;
  amountCents: number;
  householdId: string;
}): AttentionItem {
  return {
    id: `opening-${params.entryId}`,
    urgency: 40,
    title: "An opening balance is awaiting your confirmation.",
    body: `Confirm ${formatCentsPlain(params.amountCents)} so balances start correctly.`,
    href: `/app/${params.householdId}/money/opening-balances/${params.entryId}`,
    amountCents: params.amountCents,
    ctaLabel: "Review opening balance",
  };
}

export function formatRoutedAttention(params: {
  proposalId: string;
  kind: "intermediary" | "recipient" | "ready_to_pay" | "stale";
  amountCents: number;
  householdId: string;
}): AttentionItem {
  const base = {
    id: `routed-${params.kind}-${params.proposalId}`,
    href: `/app/${params.householdId}/money/simplify/${params.proposalId}`,
    amountCents: params.amountCents,
  };
  switch (params.kind) {
    case "intermediary":
      return {
        ...base,
        urgency: 50,
        title: "A routed settlement needs your approval.",
        body: `Approve reducing two balances with one ${formatCentsPlain(params.amountCents)} payment.`,
        ctaLabel: "Review suggestion",
      };
    case "recipient":
      return {
        ...base,
        urgency: 50,
        title: "A routed settlement needs your acceptance.",
        body: `Agree to receive ${formatCentsPlain(params.amountCents)} outside HouseholdOS.`,
        ctaLabel: "Review suggestion",
      };
    case "ready_to_pay":
      return {
        ...base,
        urgency: 50,
        title: "A routed payment is ready to send.",
        body: `Pay ${formatCentsPlain(params.amountCents)} outside HouseholdOS, then record it here.`,
        ctaLabel: "Open proposal",
      };
    case "stale":
      return {
        ...base,
        urgency: 70,
        title: "A routed settlement proposal may be out of date.",
        body: "Balances changed since it was created. Review or cancel it.",
        ctaLabel: "Review proposal",
      };
  }
}

export function formatRefundAttention(params: {
  obligationId: string;
  amountCents: number;
  householdId: string;
}): AttentionItem {
  return {
    id: `refund-${params.obligationId}`,
    urgency: 30,
    title: "You owe a refund from an amended expense.",
    body: `Settle ${formatCentsPlain(params.amountCents)} with your roommate.`,
    href: `/app/${params.householdId}/money/reimbursements/${params.obligationId}`,
    amountCents: params.amountCents,
    ctaLabel: "Review reimbursement",
  };
}

export function formatPaymentSenderAttention(params: {
  paymentId: string;
  amountCents: number;
  householdId: string;
}): AttentionItem {
  return {
    id: `payment-sender-${params.paymentId}`,
    urgency: 30,
    title: "Your payment is still waiting for confirmation.",
    body: `Follow up on ${formatCentsPlain(params.amountCents)} if needed.`,
    href: `/app/${params.householdId}/money/payments/${params.paymentId}`,
    amountCents: params.amountCents,
    ctaLabel: "View payment",
  };
}

function formatCentsPlain(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.trunc(abs / 100);
  const rem = String(abs % 100).padStart(2, "0");
  return `${sign}$${dollars}.${rem}`;
}
