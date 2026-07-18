import Link from "next/link";
import { assertActiveMembership } from "@/lib/household-context";
import { formatMoney, statusLabel } from "@/lib/expenses/display";
import { createClient } from "@/lib/supabase/server";
import { ExpenseStatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AppBackButton } from "@/components/app-back-button";
import {
  EXPENSE_CATEGORIES,
  expenseFiltersHaveValues,
  expensesListHref,
  monthBounds,
  parseExpenseListFilters,
} from "@/lib/money/list-filters";

export const dynamic = "force-dynamic";

export default async function ExpensesListPage({
  params,
  searchParams,
}: {
  params: Promise<{ householdId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { householdId } = await params;
  const raw = await searchParams;
  const filters = parseExpenseListFilters(raw);
  await assertActiveMembership(householdId);
  const supabase = await createClient();

  let query = supabase
    .from("expenses")
    .select(
      "id, merchant, description, purchase_date, declared_total_cents, status, payer_membership_id, category",
    )
    .eq("household_id", householdId)
    .order("purchase_date", { ascending: false });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.pendingConfirmation === "yes") {
    query = query.in("status", ["draft", "ready_for_review"]);
  } else if (filters.pendingConfirmation === "no") {
    query = query.in("status", ["confirmed", "amended", "voided"]);
  }

  const payerId = filters.member || filters.payer;
  if (payerId) query = query.eq("payer_membership_id", payerId);
  if (filters.merchant) query = query.ilike("merchant", `%${filters.merchant}%`);
  if (filters.category) query = query.eq("category", filters.category);

  if (filters.month) {
    const bounds = monthBounds(filters.month);
    if (bounds) {
      query = query.gte("purchase_date", bounds.from).lt("purchase_date", bounds.toExclusive);
    }
  } else {
    if (filters.from) query = query.gte("purchase_date", filters.from);
    if (filters.to) query = query.lte("purchase_date", filters.to);
  }

  const [{ data: expenses }, { data: memberships }, receiptRows, disputeRows] =
    await Promise.all([
      query.limit(100),
      supabase
        .from("household_memberships")
        .select("id, profiles(display_name, email)")
        .eq("household_id", householdId)
        .eq("status", "active"),
      filters.hasReceipt
        ? supabase
            .from("expense_receipts")
            .select("expense_id")
            .eq("household_id", householdId)
            .not("expense_id", "is", null)
            .is("deleted_at", null)
            .limit(500)
        : Promise.resolve({ data: null }),
      filters.disputed
        ? supabase
            .from("reimbursement_disputes")
            .select("expense_id")
            .eq("household_id", householdId)
            .in("status", ["open", "under_review"])
            .not("expense_id", "is", null)
            .limit(200)
        : Promise.resolve({ data: null }),
    ]);

  let rows = expenses ?? [];

  if (filters.hasReceipt && receiptRows.data) {
    const withReceipt = new Set(
      receiptRows.data.map((r) => r.expense_id).filter(Boolean) as string[],
    );
    rows =
      filters.hasReceipt === "yes"
        ? rows.filter((e) => withReceipt.has(e.id))
        : rows.filter((e) => !withReceipt.has(e.id));
  }

  if (filters.disputed && disputeRows.data) {
    const disputed = new Set(
      disputeRows.data.map((d) => d.expense_id).filter(Boolean) as string[],
    );
    rows =
      filters.disputed === "yes"
        ? rows.filter((e) => disputed.has(e.id))
        : rows.filter((e) => !disputed.has(e.id));
  }

  const nameOf = (id: string) => {
    const m = (memberships ?? []).find((x) => x.id === id);
    const p = m?.profiles as { display_name: string | null; email: string } | null;
    return p?.display_name || p?.email || "Member";
  };

  const hasFilters = expenseFiltersHaveValues(filters);

  return (
    <main className="space-y-4" data-testid="expenses-list">
      <AppBackButton fallbackHref={`/app/${householdId}/money`} />
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Expenses
        </h1>
        <Link
          href={`/app/${householdId}/money/expenses/new`}
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
        >
          New
        </Link>
      </div>

      <form
        className="flex flex-wrap gap-2 text-sm"
        data-testid="expense-filters"
        method="get"
      >
        <select
          name="status"
          defaultValue={filters.status ?? ""}
          className="min-h-11 rounded-md border border-border bg-input-bg px-2 py-1"
        >
          <option value="">All statuses</option>
          {["draft", "ready_for_review", "confirmed", "amended", "voided"].map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
        <select
          name="member"
          defaultValue={payerId ?? ""}
          className="min-h-11 rounded-md border border-border bg-input-bg px-2 py-1"
        >
          <option value="">All members (payer)</option>
          {(memberships ?? []).map((m) => (
            <option key={m.id} value={m.id}>
              {nameOf(m.id)}
            </option>
          ))}
        </select>
        <select
          name="category"
          defaultValue={filters.category ?? ""}
          className="min-h-11 rounded-md border border-border bg-input-bg px-2 py-1"
        >
          <option value="">All categories</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          type="month"
          name="month"
          defaultValue={filters.month ?? ""}
          className="min-h-11 rounded-md border border-border bg-input-bg px-2 py-1"
          aria-label="Month"
        />
        <input
          type="search"
          name="merchant"
          defaultValue={filters.merchant ?? ""}
          placeholder="Merchant"
          className="min-h-11 min-w-[8rem] rounded-md border border-border bg-input-bg px-2 py-1"
          aria-label="Merchant"
        />
        <select
          name="hasReceipt"
          defaultValue={filters.hasReceipt ?? ""}
          className="min-h-11 rounded-md border border-border bg-input-bg px-2 py-1"
        >
          <option value="">Receipt: any</option>
          <option value="yes">Has receipt</option>
          <option value="no">No receipt</option>
        </select>
        <select
          name="disputed"
          defaultValue={filters.disputed ?? ""}
          className="min-h-11 rounded-md border border-border bg-input-bg px-2 py-1"
        >
          <option value="">Dispute: any</option>
          <option value="yes">Disputed</option>
          <option value="no">Not disputed</option>
        </select>
        <select
          name="pendingConfirmation"
          defaultValue={filters.pendingConfirmation ?? ""}
          className="min-h-11 rounded-md border border-border bg-input-bg px-2 py-1"
        >
          <option value="">Pending: any</option>
          <option value="yes">Needs confirmation</option>
          <option value="no">Not pending</option>
        </select>
        <button
          type="submit"
          className="min-h-11 rounded-md border border-border bg-secondary px-3 py-1 text-secondary-foreground"
        >
          Filter
        </button>
        {hasFilters ? (
          <Link
            href={expensesListHref(householdId)}
            className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-secondary-foreground"
          >
            Reset
          </Link>
        ) : null}
      </form>

      {rows.length === 0 ? (
        <EmptyState
          testId="empty-expense-list"
          title={hasFilters ? "No matching expenses" : "No expenses yet"}
          description={
            hasFilters
              ? "Nothing matches these filters. Clear or change filters to see other expenses."
              : "This household has not recorded any shared purchases yet. Create a draft expense to start tracking reimbursements."
          }
          action={
            !hasFilters ? (
              <Link
                href={`/app/${householdId}/money/expenses/new`}
                className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                New expense
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border bg-surface">
          {rows.map((e) => (
            <li key={e.id}>
              <Link
                href={
                  e.status === "draft" || e.status === "ready_for_review"
                    ? `/app/${householdId}/money/expenses/${e.id}/edit`
                    : `/app/${householdId}/money/expenses/${e.id}`
                }
                className="block space-y-1.5 px-4 py-3.5 hover:bg-surface-interactive"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium">
                    {e.merchant || e.description || "Expense"}
                  </span>
                  <span className="tabular-nums">{formatMoney(e.declared_total_cents)}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
                  <span>
                    {e.purchase_date} · {nameOf(e.payer_membership_id)} paid
                    {e.category ? ` · ${e.category}` : null}
                  </span>
                  <ExpenseStatusBadge status={e.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
