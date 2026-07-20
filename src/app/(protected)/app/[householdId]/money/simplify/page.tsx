import Link from "next/link";
import { assertActiveMembership } from "@/lib/household-context";
import { listActiveMemberOptions } from "@/lib/expenses/queries";
import {
  loadSimplifySuggestions,
  listRoutedProposals,
} from "@/lib/payments/opening-routed-queries";
import { SimplifySuggestionList } from "@/components/payments/SimplifySuggestionList";
import { AppBackButton } from "@/components/app-back-button";
import { formatMoney } from "@/lib/expenses/display";
import { householdRoutes } from "@/lib/routes/household";

export const dynamic = "force-dynamic";

export default async function SimplifyBalancesPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const ctx = await assertActiveMembership(householdId);

  const [suggestions, proposals, members] = await Promise.all([
    loadSimplifySuggestions(householdId),
    listRoutedProposals(householdId),
    listActiveMemberOptions(householdId),
  ]);

  const label = (id: string) =>
    members.find((m) => m.id === id)?.label ?? id.slice(0, 8);

  return (
    <main className="space-y-8">
      <AppBackButton fallbackHref={householdRoutes.money.index(householdId)} />
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Simplify balances
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-text-muted">
          When A owes B and B owes C, a routed payment lets A pay C outside the app
          (Venmo, Cash App, Zelle, cash, etc.). After everyone agrees and C confirms
          receipt, HouseholdOS reduces both related balances. Money never moves through
          this app. Only the payer can create a binding proposal.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Suggestions</h2>
        <SimplifySuggestionList
          householdId={householdId}
          suggestions={suggestions}
          memberLabel={label}
          currentMembershipId={ctx.membershipId}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Open routed payments</h2>
        {proposals.length === 0 ? (
          <p className="text-sm text-text-muted">No proposals yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {proposals.map((p) => (
              <li key={p.id}>
                <Link
                  href={householdRoutes.money.simplifyProposal(householdId, p.id)}
                  className="flex min-h-11 items-center justify-between gap-3 px-3 py-3 text-sm hover:bg-surface"
                >
                  <span>
                    {label(p.payer_membership_id)} → {label(p.recipient_membership_id)} via{" "}
                    {label(p.intermediary_membership_id)}
                  </span>
                  <span className="tabular-nums text-text-muted">
                    {formatMoney(p.amount_cents)} · {p.status}
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
