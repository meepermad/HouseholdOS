/**
 * "Add to Money" create sheet options.
 *
 * The create sheet only lists ways to *add* a record. Browsing surfaces
 * (ledger, balances, settings) stay in the Money tools sheet.
 */

export type MoneyCreateActionKey =
  | "scan_receipt"
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
  /** Everyday entry points, always visible when the sheet opens. */
  primary: MoneyCreateAction[];
  /** Rarer entry points behind a "More ways to add" disclosure. */
  more: MoneyCreateAction[];
};

export type MoneyCreateActionsInput = {
  householdId: string;
  activeMemberCount: number;
  receiptsEnabled: boolean;
  canCreateExpense: boolean;
  canCreatePayment: boolean;
  /**
   * Shared purchase proposals live in Roommate ops and only make sense when
   * there is someone else to agree to the purchase.
   */
  sharedPurchaseEnabled: boolean;
  /** Reimbursements have no create route yet; kept as an explicit switch. */
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

  if (receiptsEnabled && canCreateExpense) {
    primary.push({
      key: "scan_receipt",
      label: "Scan or upload a receipt",
      description: "Read the items off a photo or PDF, then split them.",
      href: `${base}/receipts/new`,
      testId: "money-create-scan-receipt",
    });
  }

  if (canCreateExpense) {
    primary.push({
      key: "add_expense",
      label: "Enter an expense",
      description: "Type in a shared purchase you paid for.",
      href: `${base}/expenses/new`,
      testId: "money-create-add-expense",
    });
  }

  if (canCreatePayment && activeMemberCount > 1) {
    primary.push({
      key: "record_payment",
      label: "Record a payment",
      description: "Log money you already sent a roommate outside the app.",
      href: `${base}/payments/new`,
      testId: "money-create-record-payment",
    });
  }

  if (canCreateExpense || canCreatePayment) {
    more.push({
      key: "opening_balance",
      label: "Add an opening balance",
      description: "Start from what you already owed each other.",
      href: `${base}/opening-balances/new`,
      testId: "money-create-opening-balance",
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

  if (sharedPurchaseEnabled && activeMemberCount > 1) {
    more.push({
      key: "shared_purchase",
      label: "Propose a shared purchase",
      description: "Agree on a big buy before anyone spends money.",
      href: `/app/${householdId}/ops`,
      testId: "money-create-shared-purchase",
    });
  }

  return { primary, more };
}

/** True when the sheet has nothing to offer and should not be rendered. */
export function isMoneyCreateEmpty(groups: MoneyCreateGroups): boolean {
  return groups.primary.length === 0 && groups.more.length === 0;
}
