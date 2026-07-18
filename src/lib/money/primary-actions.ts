export type PrimaryActionKey =
  | "confirm_payment"
  | "record_payment"
  | "review_receipts"
  | "scan_receipt"
  | "add_expense";

export type PrimaryAction = {
  key: PrimaryActionKey;
  label: string;
  href: string;
  testId: string;
};

export type PrimaryActionInput = {
  householdId: string;
  activeMemberCount: number;
  receiptsEnabled: boolean;
  canCreateExpense: boolean;
  canCreatePayment: boolean;
  paymentConfirmCount: number;
  /** First payment awaiting confirmation (for deep link). */
  firstConfirmPaymentId?: string | null;
  officialYouOweCents: number;
  receiptDraftCount: number;
};

/**
 * At most two dominant Money hub actions, prioritized by likely next step.
 */
export function selectPrimaryActions(input: PrimaryActionInput): PrimaryAction[] {
  const {
    householdId,
    activeMemberCount,
    receiptsEnabled,
    canCreateExpense,
    canCreatePayment,
    paymentConfirmCount,
    firstConfirmPaymentId,
    officialYouOweCents,
    receiptDraftCount,
  } = input;

  const base = `/app/${householdId}/money`;
  const scan: PrimaryAction | null =
    receiptsEnabled && canCreateExpense
      ? {
          key: "scan_receipt",
          label: "Scan receipt",
          href: `${base}/receipts/new`,
          testId: "money-primary-scan-receipt",
        }
      : null;
  const addExpense: PrimaryAction | null = canCreateExpense
    ? {
        key: "add_expense",
        label: "Add expense",
        href: `${base}/expenses/new`,
        testId: "money-primary-add-expense",
      }
    : null;
  const recordPayment: PrimaryAction | null =
    canCreatePayment && activeMemberCount > 1
      ? {
          key: "record_payment",
          label: "Record payment",
          href: `${base}/payments/new`,
          testId: "money-primary-record-payment",
        }
      : null;
  const confirmPayment: PrimaryAction | null =
    paymentConfirmCount > 0
      ? {
          key: "confirm_payment",
          label:
            paymentConfirmCount === 1
              ? "Confirm payment"
              : `Confirm ${paymentConfirmCount} payments`,
          href: firstConfirmPaymentId
            ? `${base}/payments/${firstConfirmPaymentId}`
            : `${base}/payments?pendingConfirmation=yes`,
          testId: "money-primary-confirm-payment",
        }
      : null;
  const reviewReceipts: PrimaryAction | null =
    receiptsEnabled && receiptDraftCount > 0
      ? {
          key: "review_receipts",
          label:
            receiptDraftCount === 1
              ? "Review 1 receipt"
              : `Review ${receiptDraftCount} receipts`,
          href: `${base}/receipts`,
          testId: "money-primary-review-receipts",
        }
      : null;

  const pick = (...candidates: Array<PrimaryAction | null>): PrimaryAction[] => {
    const out: PrimaryAction[] = [];
    for (const c of candidates) {
      if (!c) continue;
      if (out.some((x) => x.key === c.key)) continue;
      out.push(c);
      if (out.length >= 2) break;
    }
    return out;
  };

  if (confirmPayment) {
    return pick(confirmPayment, scan, addExpense);
  }

  if (activeMemberCount > 1 && officialYouOweCents > 0 && recordPayment) {
    return pick(recordPayment, scan, addExpense);
  }

  if (reviewReceipts) {
    return pick(reviewReceipts, addExpense, scan);
  }

  return pick(scan, addExpense, recordPayment);
}
