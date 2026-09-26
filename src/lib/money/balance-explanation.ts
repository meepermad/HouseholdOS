import { computeObligationBalance } from "@/lib/payments/balances";

export type ExplanationSourceKind =
  | "receipt_purchase"
  | "manual_expense"
  | "opening_balance"
  | "financial_adjustment"
  | "reimbursement"
  | "recorded_payment"
  | "settlement_correction";

export type ExplanationPayment = {
  id: string;
  label: string;
  amountCents: number;
  href: string;
  status: string;
};

export type ExplanationLineInput = {
  id: string;
  householdId: string;
  label: string;
  debtorMembershipId: string;
  creditorMembershipId: string;
  obligationKind: string;
  hasReceipt: boolean;
  originalAmountCents: number;
  effectiveAmountCents: number;
  confirmedPaidCents: number;
  pendingPaymentCents: number;
  waivedCents: number;
  officialOutstandingCents: number;
  storedStatus: string;
  href: string;
  receiptHref: string | null;
  sourceNote?: string | null;
  payments?: ExplanationPayment[];
  itemShares?: Array<{ description: string; amountCents: number }>;
};

export type ExplanationLine = {
  id: string;
  label: string;
  sourceKind: ExplanationSourceKind;
  sourceNote: string;
  originalCents: number;
  effectiveCents: number;
  paidCents: number;
  waivedCents: number;
  pendingCents: number;
  remainingCents: number;
  href: string;
  receiptHref: string | null;
  direction: "you_owe" | "owed_to_you";
  payments: ExplanationPayment[];
  itemShares: Array<{ description: string; amountCents: number }>;
};

export type BalanceExplanation = {
  counterpartyName: string;
  youOweCents: number;
  theyOweYouCents: number;
  /** Positive when you owe them on the simplified net. */
  netCents: number;
  netSentence: string;
  linesYouOwe: ExplanationLine[];
  linesTheyOwe: ExplanationLine[];
  payments: ExplanationPayment[];
};

export class BalanceReconciliationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BalanceReconciliationError";
  }
}

export function sourceKindFor(line: {
  obligationKind: string;
  hasReceipt: boolean;
  waivedCents: number;
}): ExplanationSourceKind {
  if (line.obligationKind === "opening_balance") return "opening_balance";
  if (line.obligationKind === "refund") return "settlement_correction";
  if (line.hasReceipt) return "receipt_purchase";
  if (line.waivedCents > 0 && line.obligationKind === "adjustment") {
    return "financial_adjustment";
  }
  return "manual_expense";
}

export function sourceNoteFor(kind: ExplanationSourceKind, custom?: string | null): string {
  if (custom && custom.trim()) return custom.trim();
  switch (kind) {
    case "opening_balance":
      return "Opening balance. No receipt is attached to this starting balance.";
    case "receipt_purchase":
      return "Receipt purchase.";
    case "manual_expense":
      return "Manually entered expense. No receipt is attached.";
    case "financial_adjustment":
      return "Financial adjustment.";
    case "reimbursement":
      return "Reimbursement.";
    case "recorded_payment":
      return "Recorded payment.";
    case "settlement_correction":
      return "Settlement correction. This is not a new purchase.";
  }
}

export function buildBalanceExplanation(params: {
  viewerMembershipId: string;
  counterpartyMembershipId: string;
  counterpartyName: string;
  lines: readonly ExplanationLineInput[];
}): BalanceExplanation {
  const households = new Set(params.lines.map((line) => line.householdId));
  if (households.size > 1) {
    throw new BalanceReconciliationError(
      "Balance explanation mixed records from more than one household.",
    );
  }

  const linesYouOwe: ExplanationLine[] = [];
  const linesTheyOwe: ExplanationLine[] = [];
  const payments: ExplanationPayment[] = [];

  for (const line of params.lines) {
    const involvesViewer =
      line.debtorMembershipId === params.viewerMembershipId ||
      line.creditorMembershipId === params.viewerMembershipId;
    const involvesCounterparty =
      line.debtorMembershipId === params.counterpartyMembershipId ||
      line.creditorMembershipId === params.counterpartyMembershipId;
    if (!involvesViewer || !involvesCounterparty) continue;

    const reversed = line.storedStatus === "reversed";
    const computed = computeObligationBalance({
      originalAmountCents: line.originalAmountCents,
      effectiveAmountCents: reversed ? 0 : line.effectiveAmountCents,
      confirmedPaidCents: line.confirmedPaidCents,
      pendingPaymentCents: line.pendingPaymentCents,
      waivedCents: line.waivedCents,
      isReversed: reversed,
    });
    if (computed.officialOutstandingCents !== line.officialOutstandingCents) {
      throw new BalanceReconciliationError(
        `Balance explanation does not reconcile for ${line.id}.`,
      );
    }

    const kind = sourceKindFor(line);
    const explained: ExplanationLine = {
      id: line.id,
      label: line.label,
      sourceKind: kind,
      sourceNote: sourceNoteFor(kind, line.sourceNote),
      originalCents: line.originalAmountCents,
      effectiveCents: reversed ? 0 : line.effectiveAmountCents,
      paidCents: line.confirmedPaidCents,
      waivedCents: line.waivedCents,
      pendingCents: line.pendingPaymentCents,
      remainingCents: line.officialOutstandingCents,
      href: line.href,
      receiptHref: line.receiptHref,
      direction:
        line.debtorMembershipId === params.viewerMembershipId
          ? "you_owe"
          : "owed_to_you",
      payments: (line.payments ?? []).filter((payment) => payment.status === "confirmed"),
      itemShares: line.itemShares ?? [],
    };
    if (explained.direction === "you_owe") linesYouOwe.push(explained);
    else linesTheyOwe.push(explained);
    for (const payment of explained.payments) {
      if (!payments.some((existing) => existing.id === payment.id)) {
        payments.push(payment);
      }
    }
  }

  const youOweCents = linesYouOwe.reduce((sum, line) => sum + line.remainingCents, 0);
  const theyOweYouCents = linesTheyOwe.reduce((sum, line) => sum + line.remainingCents, 0);
  const netCents = youOweCents - theyOweYouCents;
  const name = params.counterpartyName;
  const netSentence =
    netCents > 0
      ? `Suggested net settlement: you pay ${name} ${formatDollars(netCents)}.`
      : netCents < 0
        ? `Suggested net settlement: ${name} pays you ${formatDollars(-netCents)}.`
        : "Suggested net settlement: no payment either way.";

  return {
    counterpartyName: name,
    youOweCents,
    theyOweYouCents,
    netCents,
    netSentence,
    linesYouOwe,
    linesTheyOwe,
    payments,
  };
}

function formatDollars(cents: number): string {
  const abs = Math.abs(cents);
  return `$${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export const SOURCE_KIND_LABEL: Record<ExplanationSourceKind, string> = {
  receipt_purchase: "Receipt purchase",
  manual_expense: "Manually entered expense",
  opening_balance: "Opening balance",
  financial_adjustment: "Financial adjustment",
  reimbursement: "Reimbursement",
  recorded_payment: "Recorded payment",
  settlement_correction: "Settlement correction",
};
