import Link from "next/link";
import { assertActiveMembership } from "@/lib/household-context";
import { formatMoney, statusLabel } from "@/lib/expenses/display";
import { createClient } from "@/lib/supabase/server";

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

  const { data: expenses } = await query.limit(100);

  const { data: memberships } = await supabase
    .from("household_memberships")
    .select("id, profiles(display_name, email)")
    .eq("household_id", householdId)
    .eq("status", "active");

  const nameOf = (id: string) => {
    const m = (memberships ?? []).find((x) => x.id === id);
    const p = m?.profiles as { display_name: string | null; email: string } | null;
    return p?.display_name || p?.email || "Member";
  };

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Expenses</h1>
        <Link
          href={`/app/${householdId}/money/expenses/new`}
          className="rounded-md bg-accent px-3 py-2 text-sm text-white"
        >
          New
        </Link>
      </div>

      <form className="flex flex-wrap gap-2 text-sm">
        <select
          name="status"
          defaultValue={filters.status ?? ""}
          className="rounded-md border border-line bg-surface px-2 py-1"
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
          className="rounded-md border border-line bg-surface px-2 py-1"
        >
          <option value="">All payers</option>
          {(memberships ?? []).map((m) => (
            <option key={m.id} value={m.id}>
              {nameOf(m.id)}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-md border border-line px-3 py-1">
          Filter
        </button>
      </form>

      {(expenses ?? []).length === 0 ? (
        <p className="text-sm text-slate-600" data-testid="empty-expense-list">
          No expenses match these filters.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-md border border-line bg-surface">
          {(expenses ?? []).map((e) => (
            <li key={e.id}>
              <Link
                href={
                  e.status === "draft" || e.status === "ready_for_review"
                    ? `/app/${householdId}/money/expenses/${e.id}/edit`
                    : `/app/${householdId}/money/expenses/${e.id}`
                }
                className="block space-y-1 px-3 py-3 hover:bg-black/5"
              >
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{e.merchant || e.description || "Expense"}</span>
                  <span>{formatMoney(e.declared_total_cents)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>
                    {e.purchase_date} · {nameOf(e.payer_membership_id)} paid
                  </span>
                  <span>{statusLabel(e.status)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
