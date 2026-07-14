import Link from "next/link";
import { assertActiveMembership } from "@/lib/household-context";
import { formatMoney } from "@/lib/expenses/display";
import { getBalancesForMembership, listActiveMemberOptions } from "@/lib/expenses/queries";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function BalancesPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const ctx = await assertActiveMembership(householdId);
  const balances = await getBalancesForMembership(householdId, ctx.membershipId);
  const members = await listActiveMemberOptions(householdId);
  const label = (id: string) =>
    members.find((m) => m.id === id)?.label ?? id.slice(0, 8);

  const supabase = await createClient();
  const { data: obligations } = await supabase
    .from("reimbursement_obligations")
    .select(
      "id, expense_id, debtor_membership_id, creditor_membership_id, current_amount_cents, status, expenses(merchant, purchase_date)",
    )
    .eq("household_id", householdId)
    .eq("status", "pending")
    .or(
      `debtor_membership_id.eq.${ctx.membershipId},creditor_membership_id.eq.${ctx.membershipId}`,
    )
    .order("created_at", { ascending: false });

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Balances</h1>
        <Link href={`/app/${householdId}/money`} className="text-sm underline">
          Money home
        </Link>
      </div>

      <section className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md border border-line bg-surface p-3">
          <p className="text-xs text-slate-500">You owe</p>
          <p className="text-xl font-semibold" data-testid="you-owe">
            {formatMoney(balances.youOwe)}
          </p>
        </div>
        <div className="rounded-md border border-line bg-surface p-3">
          <p className="text-xs text-slate-500">You are owed</p>
          <p className="text-xl font-semibold" data-testid="you-are-owed">
            {formatMoney(balances.youAreOwed)}
          </p>
        </div>
        <div className="rounded-md border border-line bg-surface p-3">
          <p className="text-xs text-slate-500">Net</p>
          <p className="text-xl font-semibold" data-testid="net-position">
            {formatMoney(balances.net)}
          </p>
        </div>
      </section>

      <p className="text-xs text-slate-600">
        Net is informational. Individual obligations remain until settled in a future payment
        phase.
      </p>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Open obligations
        </h2>
        {(obligations ?? []).length === 0 ? (
          <p className="text-sm text-slate-600">You have no open reimbursements.</p>
        ) : (
          <ul className="divide-y divide-line rounded-md border border-line bg-surface">
            {(obligations ?? []).map((o) => {
              const expense = o.expenses as {
                merchant: string;
                purchase_date: string;
              } | null;
              return (
                <li key={o.id}>
                  <Link
                    href={`/app/${householdId}/money/expenses/${o.expense_id}`}
                    className="block space-y-1 px-3 py-3 text-sm hover:bg-black/5"
                  >
                    <div className="flex justify-between">
                      <span>
                        {label(o.debtor_membership_id)} → {label(o.creditor_membership_id)}
                      </span>
                      <span className="font-medium">
                        {formatMoney(o.current_amount_cents)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {expense?.merchant} · {expense?.purchase_date}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
