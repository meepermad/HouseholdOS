import Link from "next/link";
import { assertActiveMembership } from "@/lib/household-context";
import { formatMoney } from "@/lib/expenses/display";
import { createClient } from "@/lib/supabase/server";
import { ExpenseStatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AppBackButton } from "@/components/app-back-button";
import { statusLabel } from "@/lib/expenses/display";

export const dynamic = "force-dynamic";

export default async function ExpensesListPage({
  params,
  searchParams,
}: {
  params: Promise<{ householdId: string }>;
  searchParams: Promise<{ status?: string; payer?: string }>;
}) {
  const { householdId } = await params;
  const filters = await searchParams;
  await assertActiveMembership(householdId);
  const supabase = await createClient();

  let query = supabase
    .from("expenses")
    .select(
      "id, merchant, description, purchase_date, declared_total_cents, status, payer_membership_id",
    )
    .eq("household_id", householdId)
    .order("purchase_date", { ascending: false });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.payer) query = query.eq("payer_membership_id", filters.payer);

  const [{ data: expenses }, { data: memberships }] = await Promise.all([
    query.limit(100),
    supabase
      .from("household_memberships")
      .select("id, profiles(display_name, email)")
      .eq("household_id", householdId)
      .eq("status", "active"),
  ]);

  const nameOf = (id: string) => {
    const m = (memberships ?? []).find((x) => x.id === id);
    const p = m?.profiles as { display_name: string | null; email: string } | null;
    return p?.display_name || p?.email || "Member";
  };

  const hasFilters = Boolean(filters.status || filters.payer);

  return (
    <main className="space-y-4">
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

      <form className="flex flex-wrap gap-2 text-sm">
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
          name="payer"
          defaultValue={filters.payer ?? ""}
          className="min-h-11 rounded-md border border-border bg-input-bg px-2 py-1"
        >
          <option value="">All payers</option>
          {(memberships ?? []).map((m) => (
            <option key={m.id} value={m.id}>
              {nameOf(m.id)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="min-h-11 rounded-md border border-border bg-secondary px-3 py-1 text-secondary-foreground"
        >
          Filter
        </button>
      </form>

      {(expenses ?? []).length === 0 ? (
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
          {(expenses ?? []).map((e) => (
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
