import Link from "next/link";
import { assertActiveMembership } from "@/lib/household-context";
import { formatMoney } from "@/lib/expenses/display";
import { getBalancesForMembership, listActiveMemberOptions } from "@/lib/expenses/queries";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/empty-state";
import { AppBackButton } from "@/components/app-back-button";

export const dynamic = "force-dynamic";

export default async function BalancesPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const ctx = await assertActiveMembership(householdId);

  const [balances, members, obligationsResult] = await Promise.all([
    getBalancesForMembership(householdId, ctx.membershipId),
    listActiveMemberOptions(householdId),
    (async () => {
      const supabase = await createClient();
      return supabase
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
    })(),
  ]);

  const label = (id: string) =>
    members.find((m) => m.id === id)?.label ?? id.slice(0, 8);
  const obligations = obligationsResult.data;

  return (
    <main className="space-y-6">
      <AppBackButton fallbackHref={`/app/${householdId}/money`} />
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Balances
        </h1>
        <Link
          href={`/app/${householdId}/money`}
          className="text-sm text-text-secondary underline"
        >
          Money home
        </Link>
      </div>

      <section className="grid grid-cols-1 gap-2 text-center sm:grid-cols-3">
        <div className="rounded-md border border-border bg-surface p-3">
          <p className="text-xs text-text-muted">You owe</p>
          <p className="text-xl font-semibold tabular-nums" data-testid="you-owe">
            {formatMoney(balances.youOwe)}
          </p>
        </div>
        <div className="rounded-md border border-border bg-surface p-3">
          <p className="text-xs text-text-muted">You are owed</p>
          <p
            className="text-xl font-semibold tabular-nums"
            data-testid="you-are-owed"
          >
            {formatMoney(balances.youAreOwed)}
          </p>
        </div>
        <div className="rounded-md border border-border bg-surface p-3">
          <p className="text-xs text-text-muted">Net</p>
          <p
            className="text-xl font-semibold tabular-nums"
            data-testid="net-position"
          >
            {formatMoney(balances.net)}
          </p>
        </div>
      </section>

      <p className="text-xs text-text-muted">
        Net is informational. Individual obligations remain until settled in a future payment
        phase.
      </p>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Open obligations
        </h2>
        {(obligations ?? []).length === 0 ? (
          <EmptyState
            title="No open reimbursements"
            description="When confirmed expenses create obligations involving you, they will appear here. Settling payments arrives in a later phase."
          />
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border bg-surface">
            {(obligations ?? []).map((o) => {
              const expense = o.expenses as {
                merchant: string;
                purchase_date: string;
              } | null;
              return (
                <li key={o.id}>
                  <Link
                    href={`/app/${householdId}/money/expenses/${o.expense_id}`}
                    className="block space-y-1 px-3 py-3 text-sm hover:bg-surface-interactive"
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <span>
                        {label(o.debtor_membership_id)} →{" "}
                        {label(o.creditor_membership_id)}
                      </span>
                      <span className="font-medium tabular-nums">
                        {formatMoney(o.current_amount_cents)}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted">
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
