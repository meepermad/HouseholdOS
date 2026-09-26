import { suggestOldestFirstAllocation } from "@/lib/payments/allocate";
import type { AllocationLine, ObligationForAllocation } from "@/lib/payments/types";

/** Page size for the expense picker. Select-all applies to the current page. */
export const SETTLEMENT_PAGE_SIZE = 8;

export type SettlementDirection = "sent" | "received";

export type SettlementExpense = {
  id: string;
  label: string;
  householdId: string;
  debtorMembershipId: string;
  creditorMembershipId: string;
  currency: string;
  effectiveAmountCents: number;
  officialOutstandingCents: number;
  pendingPaymentCents: number;
  createdAt: string;
  eligible: boolean;
  ineligibleReason?: string;
};

export function parseDollarsToCents(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [dollars, fraction = ""] = trimmed.split(".");
  const cents = Number(dollars) * 100 + Number((fraction + "00").slice(0, 2));
  if (!Number.isInteger(cents) || cents <= 0) return null;
  return cents;
}

export function formatCentsAsDollars(cents: number): string {
  const abs = Math.abs(cents);
  return `${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export function availableCents(
  expense: SettlementExpense,
  direction: SettlementDirection,
): number {
  const official = Math.max(0, expense.officialOutstandingCents);
  if (!expense.eligible) return 0;
  if (direction === "received") return official;
  return Math.max(0, official - Math.max(0, expense.pendingPaymentCents));
}

export function isSelectable(
  expense: SettlementExpense,
  direction: SettlementDirection,
): boolean {
  return expense.eligible && availableCents(expense, direction) > 0;
}

export function filterExpenses(
  expenses: readonly SettlementExpense[],
  query: string,
): SettlementExpense[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...expenses];
  return expenses.filter((expense) => expense.label.toLowerCase().includes(needle));
}

export function pageExpenses<T>(
  items: readonly T[],
  page: number,
  pageSize = SETTLEMENT_PAGE_SIZE,
): { rows: T[]; page: number; pageCount: number } {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(0, page), pageCount - 1);
  const start = safePage * pageSize;
  return {
    rows: items.slice(start, start + pageSize),
    page: safePage,
    pageCount,
  };
}

export function selectIds(
  current: ReadonlySet<string>,
  ids: readonly string[],
): Set<string> {
  const next = new Set(current);
  for (const id of ids) next.add(id);
  return next;
}

export function deselectIds(
  current: ReadonlySet<string>,
  ids: readonly string[],
): Set<string> {
  const next = new Set(current);
  for (const id of ids) next.delete(id);
  return next;
}

export function toggleId(current: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export type SelectionSummary = {
  count: number;
  totalCents: number;
  selected: SettlementExpense[];
  /** Selected records that are no longer eligible. Named, never a generic empty selection. */
  attention: Array<{ id: string; label: string; reason: string }>;
};

export function summarizeSelection(
  selectedIds: ReadonlySet<string>,
  expenses: readonly SettlementExpense[],
  direction: SettlementDirection,
): SelectionSummary {
  const byId = new Map(expenses.map((expense) => [expense.id, expense]));
  const selected: SettlementExpense[] = [];
  const attention: SelectionSummary["attention"] = [];

  for (const id of selectedIds) {
    const expense = byId.get(id);
    if (!expense) {
      attention.push({
        id,
        label: "An expense",
        reason: "It is no longer part of this household balance.",
      });
      continue;
    }
    if (!isSelectable(expense, direction)) {
      attention.push({
        id,
        label: expense.label,
        reason:
          expense.ineligibleReason ??
          "It is no longer an open balance you can settle.",
      });
      continue;
    }
    selected.push(expense);
  }

  selected.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  return {
    count: selected.length,
    totalCents: selected.reduce(
      (sum, expense) => sum + availableCents(expense, direction),
      0,
    ),
    selected,
    attention,
  };
}

export function selectionCountLabel(count: number): string {
  return count === 1 ? "1 expense selected" : `${count} expenses selected`;
}

export function toAllocationObligation(
  expense: SettlementExpense,
  direction: SettlementDirection,
): ObligationForAllocation {
  return {
    id: expense.id,
    householdId: expense.householdId,
    debtorMembershipId: expense.debtorMembershipId,
    creditorMembershipId: expense.creditorMembershipId,
    currency: expense.currency,
    effectiveAmountCents: expense.effectiveAmountCents,
    officialOutstandingCents: availableCents(expense, direction),
    createdAt: expense.createdAt,
    sourceLabel: expense.label,
  };
}

/**
 * Allocations are derived from the selected expense ids.
 * Checkbox state alone is not submitted.
 */
export function allocationsForSelection(params: {
  expenses: readonly SettlementExpense[];
  selectedIds: ReadonlySet<string>;
  direction: SettlementDirection;
  amountCents: number;
  viewerMembershipId: string;
  counterpartyMembershipId: string;
  householdId: string;
  currency: string;
}): AllocationLine[] {
  const summary = summarizeSelection(
    params.selectedIds,
    params.expenses,
    params.direction,
  );
  if (summary.attention.length > 0) {
    const first = summary.attention[0]!;
    throw new Error(`${first.label} needs attention. ${first.reason}`);
  }
  if (summary.selected.length === 0) {
    throw new Error("Select at least one expense to settle.");
  }
  const senderMembershipId =
    params.direction === "sent"
      ? params.viewerMembershipId
      : params.counterpartyMembershipId;
  const recipientMembershipId =
    params.direction === "sent"
      ? params.counterpartyMembershipId
      : params.viewerMembershipId;
  return suggestOldestFirstAllocation({
    paymentAmountCents: params.amountCents,
    obligations: summary.selected.map((expense) =>
      toAllocationObligation(expense, params.direction),
    ),
    senderMembershipId,
    recipientMembershipId,
    householdId: params.householdId,
    currency: params.currency,
  });
}
