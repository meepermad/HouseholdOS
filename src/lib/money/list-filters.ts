/**
 * URL-backed filters for expense and payment list pages (thin A13).
 * Used by list UIs and deep links from Money overview / monthly summary.
 */

export const EXPENSE_CATEGORIES = [
  "groceries",
  "household",
  "utilities",
  "dining",
  "transport",
  "health",
  "other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type ExpenseListFilters = {
  status?: string;
  payer?: string;
  member?: string;
  merchant?: string;
  category?: string;
  month?: string;
  from?: string;
  to?: string;
  hasReceipt?: "yes" | "no";
  disputed?: "yes" | "no";
  pendingConfirmation?: "yes" | "no";
};

export type PaymentListFilters = {
  status?: string;
  member?: string;
  month?: string;
  from?: string;
  to?: string;
  minCents?: number;
  maxCents?: number;
  disputed?: "yes" | "no";
  pendingConfirmation?: "yes" | "no";
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

function one(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value || undefined;
}

function yn(value: string | undefined): "yes" | "no" | undefined {
  if (value === "yes" || value === "no") return value;
  return undefined;
}

function intOrUndef(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
}

export function parseExpenseListFilters(
  raw: Record<string, string | string[] | undefined>,
): ExpenseListFilters {
  const month = one(raw.month);
  const from = one(raw.from);
  const to = one(raw.to);
  return {
    status: one(raw.status),
    payer: one(raw.payer),
    member: one(raw.member),
    merchant: one(raw.merchant)?.trim().slice(0, 200) || undefined,
    category: one(raw.category),
    month: month && MONTH_RE.test(month) ? month : undefined,
    from: from && DATE_RE.test(from) ? from : undefined,
    to: to && DATE_RE.test(to) ? to : undefined,
    hasReceipt: yn(one(raw.hasReceipt)),
    disputed: yn(one(raw.disputed)),
    pendingConfirmation: yn(one(raw.pendingConfirmation)),
  };
}

export function parsePaymentListFilters(
  raw: Record<string, string | string[] | undefined>,
): PaymentListFilters {
  const month = one(raw.month);
  const from = one(raw.from);
  const to = one(raw.to);
  return {
    status: one(raw.status),
    member: one(raw.member),
    month: month && MONTH_RE.test(month) ? month : undefined,
    from: from && DATE_RE.test(from) ? from : undefined,
    to: to && DATE_RE.test(to) ? to : undefined,
    minCents: intOrUndef(one(raw.minCents)),
    maxCents: intOrUndef(one(raw.maxCents)),
    disputed: yn(one(raw.disputed)),
    pendingConfirmation: yn(one(raw.pendingConfirmation)),
  };
}

export function expenseFiltersHaveValues(f: ExpenseListFilters): boolean {
  return Boolean(
    f.status ||
      f.payer ||
      f.member ||
      f.merchant ||
      f.category ||
      f.month ||
      f.from ||
      f.to ||
      f.hasReceipt ||
      f.disputed ||
      f.pendingConfirmation,
  );
}

export function paymentFiltersHaveValues(f: PaymentListFilters): boolean {
  return Boolean(
    f.status ||
      f.member ||
      f.month ||
      f.from ||
      f.to ||
      f.minCents != null ||
      f.maxCents != null ||
      f.disputed ||
      f.pendingConfirmation,
  );
}

function append(params: URLSearchParams, key: string, value: string | number | undefined) {
  if (value === undefined || value === "") return;
  params.set(key, String(value));
}

export function serializeExpenseListFilters(f: ExpenseListFilters): string {
  const params = new URLSearchParams();
  append(params, "status", f.status);
  append(params, "payer", f.payer);
  append(params, "member", f.member);
  append(params, "merchant", f.merchant);
  append(params, "category", f.category);
  append(params, "month", f.month);
  append(params, "from", f.from);
  append(params, "to", f.to);
  append(params, "hasReceipt", f.hasReceipt);
  append(params, "disputed", f.disputed);
  append(params, "pendingConfirmation", f.pendingConfirmation);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function serializePaymentListFilters(f: PaymentListFilters): string {
  const params = new URLSearchParams();
  append(params, "status", f.status);
  append(params, "member", f.member);
  append(params, "month", f.month);
  append(params, "from", f.from);
  append(params, "to", f.to);
  append(params, "minCents", f.minCents);
  append(params, "maxCents", f.maxCents);
  append(params, "disputed", f.disputed);
  append(params, "pendingConfirmation", f.pendingConfirmation);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** Calendar month bounds as YYYY-MM-DD (inclusive start, exclusive end for queries). */
export function monthBounds(month: string): { from: string; toExclusive: string } | null {
  if (!MONTH_RE.test(month)) return null;
  const [y, m] = month.split("-").map(Number);
  const from = `${month}-01`;
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { from, toExclusive: next };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function currentMonthKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string, locale = "en-US"): string {
  if (!MONTH_RE.test(month)) return month;
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}

export function expensesListHref(
  householdId: string,
  filters: ExpenseListFilters = {},
): string {
  return `/app/${householdId}/money/expenses${serializeExpenseListFilters(filters)}`;
}

export function paymentsListHref(
  householdId: string,
  filters: PaymentListFilters = {},
): string {
  return `/app/${householdId}/money/payments${serializePaymentListFilters(filters)}`;
}
