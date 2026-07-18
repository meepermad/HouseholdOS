/** Friendly recent financial activity formatting (no raw audit keys). */

export type ActivityKind =
  | "expense_created"
  | "expense_confirmed"
  | "expense_amended"
  | "receipt_reviewed"
  | "payment_submitted"
  | "payment_confirmed"
  | "payment_reversed"
  | "opening_balance_confirmed"
  | "routed_proposed"
  | "routed_confirmed"
  | "dispute_opened"
  | "dispute_resolved"
  | "reimbursement_updated"
  | "utility_recorded";

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  description: string;
  amountCents: number | null;
  secondary: string | null;
  date: string;
  statusLabel: string;
  href: string;
  sortAt: string;
};

export function formatActivityDescription(
  kind: ActivityKind,
  opts: { merchant?: string | null; member?: string | null } = {},
): string {
  const merchant = opts.merchant?.trim();
  const member = opts.member?.trim();
  switch (kind) {
    case "expense_created":
      return merchant ? `Expense created · ${merchant}` : "Expense created";
    case "expense_confirmed":
      return merchant ? `Expense confirmed · ${merchant}` : "Expense confirmed";
    case "expense_amended":
      return merchant ? `Expense amended · ${merchant}` : "Expense amended";
    case "receipt_reviewed":
      return merchant ? `Receipt reviewed · ${merchant}` : "Receipt reviewed";
    case "payment_submitted":
      return member
        ? `Payment submitted to ${member}`
        : "Payment submitted";
    case "payment_confirmed":
      return member
        ? `Payment confirmed with ${member}`
        : "Payment confirmed";
    case "payment_reversed":
      return "Payment reversed";
    case "opening_balance_confirmed":
      return member
        ? `Opening balance confirmed with ${member}`
        : "Opening balance confirmed";
    case "routed_proposed":
      return "Routed settlement proposed";
    case "routed_confirmed":
      return "Routed settlement confirmed";
    case "dispute_opened":
      return "Dispute opened";
    case "dispute_resolved":
      return "Dispute resolved";
    case "reimbursement_updated":
      return "Reimbursement updated";
    case "utility_recorded":
      return merchant ? `Utility expense recorded · ${merchant}` : "Utility expense recorded";
  }
}

export function activityStatusLabel(kind: ActivityKind, rawStatus?: string | null): string {
  switch (kind) {
    case "expense_created":
      return "Draft";
    case "expense_confirmed":
      return "Confirmed";
    case "expense_amended":
      return "Amended";
    case "receipt_reviewed":
      return "Reviewed";
    case "payment_submitted":
      return "Awaiting confirmation";
    case "payment_confirmed":
      return "Confirmed";
    case "payment_reversed":
      return "Reversed";
    case "opening_balance_confirmed":
      return "Confirmed";
    case "routed_proposed":
      return "Proposed";
    case "routed_confirmed":
      return "Confirmed";
    case "dispute_opened":
      return "Open";
    case "dispute_resolved":
      return "Resolved";
    case "reimbursement_updated":
      return rawStatus ? humanize(rawStatus) : "Updated";
    case "utility_recorded":
      return "Recorded";
  }
}

function humanize(s: string): string {
  return s.replaceAll("_", " ");
}

export function sortActivity(items: readonly ActivityItem[]): ActivityItem[] {
  return [...items].sort((a, b) => {
    const t = b.sortAt.localeCompare(a.sortAt);
    if (t !== 0) return t;
    return a.id.localeCompare(b.id);
  });
}
