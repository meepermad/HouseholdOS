import Link from "next/link";
import { assertActiveMembership } from "@/lib/household-context";
import { listActiveMemberOptions } from "@/lib/expenses/queries";
import { listOpeningBalances } from "@/lib/payments/opening-routed-queries";
import { AppBackButton } from "@/components/app-back-button";
import { formatMoney } from "@/lib/expenses/display";
import { householdRoutes } from "@/lib/routes/household";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function OpeningBalancesPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  await assertActiveMembership(householdId);
  const [entries, members] = await Promise.all([
    listOpeningBalances(householdId),
    listActiveMemberOptions(householdId),
  ]);
  const label = (id: string) =>
    members.find((m) => m.id === id)?.label ?? id.slice(0, 8);

  return (
    <main className="space-y-6">
      <AppBackButton fallbackHref={householdRoutes.money.index(householdId)} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            Opening balances
          </h1>
          <p className="mt-2 max-w-xl text-sm text-text-muted">
            Record pre-HouseholdOS debts. Both parties must confirm before they affect
            settle-up. No fabricated historical expenses.
          </p>
        </div>
        <Link
          href={householdRoutes.money.openingBalanceNew(householdId)}
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          New opening balance
        </Link>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          title="No opening balances"
          description="Add a balance from before you started tracking expenses here."
        />
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {entries.map((e) => (
            <li key={e.id}>
              <Link
                href={householdRoutes.money.openingBalance(householdId, e.id)}
                className="flex min-h-11 items-center justify-between gap-3 px-3 py-3 text-sm hover:bg-surface"
              >
                <span>
                  {label(e.debtor_membership_id)} owes {label(e.creditor_membership_id)}
                </span>
                <span className="tabular-nums text-text-muted">
                  {formatMoney(e.amount_cents)} · {e.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
