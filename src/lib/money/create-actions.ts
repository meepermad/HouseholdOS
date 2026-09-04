/**
 * "Add to Money" create sheet options.
 *
 * Primary: Add expense (scan / upload / enter) and Record payment.
 * Browsing stays in More money tools.
 */

export type MoneyCreateActionKey =
  | "scan_receipt"
  | "upload_receipt"
  | "add_expense"
  | "record_payment"
  | "opening_balance"
  | "reimbursement"
  | "shared_purchase";

export type MoneyCreateAction = {
  key: MoneyCreateActionKey;
  label: string;
  description: string;
  href: string;
  testId: string;
};

export type MoneyCreateGroups = {
  /** Ways to add an expense, shown inside the Add expense sheet. */
  primary: MoneyCreateAction[];
  /** Scan receipt — a sibling hub button so capture is one tap from Money. */
  scanReceipt: MoneyCreateAction | null;
  /** Record payment — a sibling hub button, not inside Add expense. */
  recordPayment: MoneyCreateAction | null;
  /** Rarer entry points behind a disclosure. */
  more: MoneyCreateAction[];
};

export type MoneyCreateActionsInput = {
  householdId: string;
  activeMemberCount: number;
  receiptsEnabled: boolean;
  canCreateExpense: boolean;
  canCreatePayment: boolean;
  sharedPurchaseEnabled: boolean;
  reimbursementCreateEnabled?: boolean;
};

/** Permission- and readiness-filtered options for the Money create sheet. */
export function buildMoneyCreateActions(
  input: MoneyCreateActionsInput,
): MoneyCreateGroups {
  const {
    householdId,
    activeMemberCount,
    receiptsEnabled,
    canCreateExpense,
    canCreatePayment,
    sharedPurchaseEnabled,
    reimbursementCreateEnabled = false,
  } = input;

  const base = `/app/${householdId}/money`;
  const primary: MoneyCreateAction[] = [];
  const more: MoneyCreateAction[] = [];
  let recordPayment: MoneyCreateAction | null = null;
  let scanReceipt: MoneyCreateAction | null = null;

  if (receiptsEnabled && canCreateExpense) {
    scanReceipt = {
      key: "scan_receipt",
      label: "Scan receipt",
      description: "Take a photo and let HouseholdOS read the items.",
      href: `${base}/receipts/new?mode=camera`,
      testId: "money-hub-scan-receipt",
    };
    primary.push({
      key: "scan_receipt",
      label: "Scan receipt",
      description: "Take a photo and let HouseholdOS read the items.",
      href: `${base}/receipts/new?mode=camera`,
      testId: "money-create-scan-receipt",
    });
    primary.push({
      key: "upload_receipt",
      label: "Upload receipt",
      description: "Choose a photo or PDF from this device.",
      href: `${base}/receipts/new?mode=file`,
      testId: "money-create-upload-receipt",
    });
  }

  if (canCreateExpense) {
    primary.push({
      key: "add_expense",
      label: "Enter manually",
      description: "Type in a shared purchase you paid for.",
      href: `${base}/expenses/new`,
      testId: "money-create-add-expense",
    });
  }

  if (canCreatePayment && activeMemberCount > 1) {
    recordPayment = {
      key: "record_payment",
      label: "Record payment",
      description: "Log money you already sent a roommate outside the app.",
      href: `${base}/payments/new`,
      testId: "money-create-record-payment",
    };
  }

  if (sharedPurchaseEnabled && activeMemberCount > 1) {
    more.push({
      key: "shared_purchase",
      label: "Propose a shared purchase",
      description: "Agree on a big buy before anyone spends money.",
      href: `/app/${householdId}/ops`,
      testId: "money-create-shared-purchase",
    });
  }

  if (reimbursementCreateEnabled && canCreatePayment) {
    more.push({
      key: "reimbursement",
      label: "Request a reimbursement",
      description: "Ask a roommate to pay you back for something.",
      href: `${base}/reimbursements/new`,
      testId: "money-create-reimbursement",
    });
  }

  return { primary, more, recordPayment, scanReceipt };
}

/** True when the sheet has nothing to offer and should not be rendered. */
export function isMoneyCreateEmpty(groups: MoneyCreateGroups): boolean {
  return (
    groups.primary.length === 0 &&
    groups.more.length === 0 &&
    groups.recordPayment === null &&
    groups.scanReceipt === null
  );
}
