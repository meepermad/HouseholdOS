/**
 * Shared monthly financial aggregation for Money hub and Monthly Household Review.
 * Draft, pending, disputed, and confirmed values stay separate.
 */

import {
  currentMonthKey,
  expensesListHref,
  monthBounds,
  monthLabel,
  paymentsListHref,
  type ExpenseCategory,
} from "@/lib/money/list-filters";

export const MONTHLY_FINANCE_AGG_VERSION = 1;

export type CategoryBucket = {
  category: ExpenseCategory | "uncategorized";
  label: string;
  confirmedCents: number;
};

export type MonthlyFinancialSummary = {
  version: typeof MONTHLY_FINANCE_AGG_VERSION;
  month: string;
  monthLabel: string;
  /** Confirmed/amended shared purchase totals in the period. */
  sharedPurchasesConfirmedCents: number;
  /** Draft + ready_for_review totals (not mixed into confirmed). */
  sharedPurchasesPendingCents: number;
  /** Current member's allocated share of confirmed expenses (when known). */
  yourAllocatedShareCents: number;
  confirmedReimbursementsCents: number;
  pendingPaymentConfirmationCents: number;
  recurringBillsCents: number;
  disputedCents: number;
  categories: CategoryBucket[];
  /** Prior-month confirmed shared purchases for delta graphics. */
  priorSharedPurchasesConfirmedCents: number | null;
  hasUsefulData: boolean;
  deepLinks: {
    sharedPurchases: string;
    pendingExpenses: string;
    pendingPayments: string;
    disputed: string;
    category: (category: string) => string;
  };
};

export type MonthlySummaryInputRow = {
  id: string;
  merchant: string;
  category: string | null;
  purchase_date: string;
  declared_total_cents: number;
  status: string;
  /** Allocated share for current member when available. */
  my_share_cents?: number | null;
};

export type MonthlyPaymentRow = {
  id: string;
  total_amount_cents: number;
  status: string;
  submitted_at: string | null;
  confirmed_at: string | null;
};

export type MonthlyUtilityRow = {
  estimated_amount_cents: number | null;
  actual_amount_cents: number | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  groceries: "Groceries",
  household: "Household supplies",
  utilities: "Utilities",
  dining: "Dining",
  transport: "Transport",
  health: "Health",
  other: "Other",
  uncategorized: "Other",
};

function inMonth(dateStr: string, from: string, toExclusive: string): boolean {
  return dateStr >= from && dateStr < toExclusive;
}

function isoDate(d: string | null): string | null {
  if (!d) return null;
  return d.slice(0, 10);
}

/**
 * Pure aggregation — safe for unit tests and meeting packet reuse.
 */
export function computeMonthlyFinancialSummary(params: {
  householdId: string;
  membershipId: string;
  month: string;
  expenses: readonly MonthlySummaryInputRow[];
  payments: readonly MonthlyPaymentRow[];
  utilities?: readonly MonthlyUtilityRow[];
  disputedObligationCents?: number;
  priorMonthExpenses?: readonly MonthlySummaryInputRow[];
}): MonthlyFinancialSummary {
  const bounds = monthBounds(params.month);
  if (!bounds) {
    return emptySummary(params.householdId, params.month);
  }
  const { from, toExclusive } = bounds;

  let sharedPurchasesConfirmedCents = 0;
  let sharedPurchasesPendingCents = 0;
  let yourAllocatedShareCents = 0;
  const categoryMap = new Map<string, number>();

  for (const e of params.expenses) {
    if (!inMonth(e.purchase_date, from, toExclusive)) continue;
    if (e.status === "voided") continue;
    if (e.status === "confirmed" || e.status === "amended") {
      sharedPurchasesConfirmedCents += e.declared_total_cents;
      if (typeof e.my_share_cents === "number") {
        yourAllocatedShareCents += e.my_share_cents;
      }
      const key = e.category && CATEGORY_LABELS[e.category] ? e.category : "uncategorized";
      categoryMap.set(key, (categoryMap.get(key) ?? 0) + e.declared_total_cents);
    } else if (e.status === "draft" || e.status === "ready_for_review") {
      sharedPurchasesPendingCents += e.declared_total_cents;
    }
  }

  let confirmedReimbursementsCents = 0;
  let pendingPaymentConfirmationCents = 0;
  for (const p of params.payments) {
    const confirmedDay = isoDate(p.confirmed_at);
    const submittedDay = isoDate(p.submitted_at);
    if (p.status === "confirmed" && confirmedDay && inMonth(confirmedDay, from, toExclusive)) {
      confirmedReimbursementsCents += p.total_amount_cents;
    }
    if (
      p.status === "submitted" &&
      submittedDay &&
      inMonth(submittedDay, from, toExclusive)
    ) {
      pendingPaymentConfirmationCents += p.total_amount_cents;
    }
  }

  let recurringBillsCents = 0;
  for (const u of params.utilities ?? []) {
    const amount = u.actual_amount_cents ?? u.estimated_amount_cents ?? 0;
    if (amount > 0) recurringBillsCents += amount;
  }

  const disputedCents = Math.max(0, params.disputedObligationCents ?? 0);

  let priorSharedPurchasesConfirmedCents: number | null = null;
  if (params.priorMonthExpenses) {
    priorSharedPurchasesConfirmedCents = 0;
    const priorMonth = shiftMonthLocal(params.month, -1);
    const priorBounds = monthBounds(priorMonth);
    if (priorBounds) {
      for (const e of params.priorMonthExpenses) {
        if (!inMonth(e.purchase_date, priorBounds.from, priorBounds.toExclusive)) continue;
        if (e.status === "confirmed" || e.status === "amended") {
          priorSharedPurchasesConfirmedCents += e.declared_total_cents;
        }
      }
    }
  }

  const categories: CategoryBucket[] = [...categoryMap.entries()]
    .map(([category, confirmedCents]) => ({
      category: category as CategoryBucket["category"],
      label: CATEGORY_LABELS[category] ?? "Other",
      confirmedCents,
    }))
    .filter((c) => c.confirmedCents > 0)
    .sort((a, b) => b.confirmedCents - a.confirmedCents || a.label.localeCompare(b.label));

  const hasUsefulData =
    sharedPurchasesConfirmedCents > 0 ||
    sharedPurchasesPendingCents > 0 ||
    confirmedReimbursementsCents > 0 ||
    pendingPaymentConfirmationCents > 0 ||
    recurringBillsCents > 0 ||
    disputedCents > 0 ||
    yourAllocatedShareCents > 0;

  return {
    version: MONTHLY_FINANCE_AGG_VERSION,
    month: params.month,
    monthLabel: monthLabel(params.month),
    sharedPurchasesConfirmedCents,
    sharedPurchasesPendingCents,
    yourAllocatedShareCents,
    confirmedReimbursementsCents,
    pendingPaymentConfirmationCents,
    recurringBillsCents,
    disputedCents,
    categories,
    priorSharedPurchasesConfirmedCents,
    hasUsefulData,
    deepLinks: {
      sharedPurchases: expensesListHref(params.householdId, {
        month: params.month,
        status: "confirmed",
      }),
      pendingExpenses: expensesListHref(params.householdId, {
        month: params.month,
        pendingConfirmation: "yes",
      }),
      pendingPayments: paymentsListHref(params.householdId, {
        month: params.month,
        pendingConfirmation: "yes",
      }),
      disputed: expensesListHref(params.householdId, {
        month: params.month,
        disputed: "yes",
      }),
      category: (category: string) =>
        expensesListHref(params.householdId, {
          month: params.month,
          category,
          status: "confirmed",
        }),
    },
  };
}

function emptySummary(householdId: string, month: string): MonthlyFinancialSummary {
  return {
    version: MONTHLY_FINANCE_AGG_VERSION,
    month,
    monthLabel: monthLabel(month),
    sharedPurchasesConfirmedCents: 0,
    sharedPurchasesPendingCents: 0,
    yourAllocatedShareCents: 0,
    confirmedReimbursementsCents: 0,
    pendingPaymentConfirmationCents: 0,
    recurringBillsCents: 0,
    disputedCents: 0,
    categories: [],
    priorSharedPurchasesConfirmedCents: null,
    hasUsefulData: false,
    deepLinks: {
      sharedPurchases: expensesListHref(householdId, { month }),
      pendingExpenses: expensesListHref(householdId, {
        month,
        pendingConfirmation: "yes",
      }),
      pendingPayments: paymentsListHref(householdId, {
        month,
        pendingConfirmation: "yes",
      }),
      disputed: expensesListHref(householdId, { month, disputed: "yes" }),
      category: (category: string) =>
        expensesListHref(householdId, { month, category, status: "confirmed" }),
    },
  };
}

function shiftMonthLocal(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function defaultMonthKey(): string {
  return currentMonthKey();
}
