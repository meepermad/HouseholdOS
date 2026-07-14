import Link from "next/link";
import { assertActiveMembership } from "@/lib/household-context";
import { formatMoney } from "@/lib/expenses/display";
import { getBalancesForMembership } from "@/lib/expenses/queries";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function MoneyHubPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const ctx = await assertActiveMembership(householdId);
  const balances = await getBalancesForMembership(householdId, ctx.membershipId);
  const supabase = await createClient();

  const { data: recent } = await supabase
    .from("expenses")
    .select("id, merchant, purchase_date, declared_total_cents, status")
    .eq("household_id", householdId)
    .order("purchase_date", { ascending: false })
    .limit(8);

  return (
    <main className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Money</h1>
        <p className="text-sm text-slate-600">
          Track shared purchases and who owes whom. Payments come in a later phase.
        </p>
      </header>

      <section className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md border border-line bg-surface p-3">
          <p className="text-xs text-slate-500">You owe</p>
          <p className="text-lg font-semibold">{formatMoney(balances.youOwe)}</p>
        </div>
        <div className="rounded-md border border-line bg-surface p-3">
          <p className="text-xs text-slate-500">You are owed</p>
          <p className="text-lg font-semibold">{formatMoney(balances.youAreOwed)}</p>
        </div>
        <div className="rounded-md border border-line bg-surface p-3">
          <p className="text-xs text-slate-500">Net</p>
          <p className="text-lg font-semibold">{formatMoney(balances.net)}</p>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {can(ctx.roles, "expense.create") ? (
          <Link
            href={`/app/${householdId}/money/expenses/new`}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
          >
            New expense
          </Link>
        ) : null}
        <Link
          href={`/app/${householdId}/money/expenses`}
          className="rounded-md border border-line bg-surface px-4 py-2 text-sm"
        >
          All expenses
        </Link>
        <Link
          href={`/app/${householdId}/money/balances`}
          className="rounded-md border border-line bg-surface px-4 py-2 text-sm"
        >
          Balances
        </Link>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Recent
        </h2>
        {(recent ?? []).length === 0 ? (
          <p className="text-sm text-slate-600" data-testid="empty-expense-list">
            No expenses yet. Create a draft to get started.
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-md border border-line bg-surface">
            {(recent ?? []).map((e) => (
              <li key={e.id}>
                <Link
                  href={`/app/${householdId}/money/expenses/${e.id}`}
                  className="flex items-center justify-between px-3 py-3 text-sm hover:bg-black/5"
                >
                  <span>
                    <span className="font-medium">{e.merchant || "Expense"}</span>
                    <span className="ml-2 text-xs text-slate-500">{e.status}</span>
                  </span>
                  <span>
                    {formatMoney(e.declared_total_cents)}
                    <span className="ml-2 text-xs text-slate-500">{e.purchase_date}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
