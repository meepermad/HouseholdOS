import Link from "next/link";
import { assertActiveMembership } from "@/lib/household-context";
import { formatMoney } from "@/lib/expenses/display";
import { getBalancesForMembership, listActiveMemberOptions } from "@/lib/expenses/queries";
import {
  getSettlementBalancesForMembership,
  listObligationBalances,
  loadObligationPurchaseSources,
} from "@/lib/payments/queries";
import { EmptyState } from "@/components/ui/empty-state";
import { AppBackButton } from "@/components/app-back-button";
import {
  ObligationSourceLinks,
} from "@/components/payments/ObligationSourceLinks";
import { sourceFromMaps } from "@/lib/payments/obligation-source";

export const dynamic = "force-dynamic";

export default async function BalancesPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const ctx = await assertActiveMembership(householdId);

  const [balances, settlement, members, obligations] = await Promise.all([
    getBalancesForMembership(householdId, ctx.membershipId),
    getSettlementBalancesForMembership(householdId, ctx.membershipId),
    listActiveMemberOptions(householdId),
    listObligationBalances(householdId),
  ]);
  const sources = await loadObligationPurchaseSources(
    householdId,
    obligations.map((o) => o.expense_id),
  );

  const label = (id: string) =>
    members.find((m) => m.id === id)?.label ?? id.slice(0, 8);

  const open = obligations.filter(
    (o) =>
      (o.debtor_membership_id === ctx.membershipId ||
        o.creditor_membership_id === ctx.membershipId) &&
      (o.official_outstanding_cents > 0 || o.pending_payment_cents > 0),
  );

  return (
    <main className="space-y-6">
      <AppBackButton fallbackHref={`/app/${householdId}/money`} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Balances
        </h1>
        <Link
          href={`/app/${householdId}/money/payments/new`}
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Settle up
        </Link>
      </div>

      <section className="grid grid-cols-1 gap-3 text-center sm:grid-cols-3">
        <div className="rounded-md border border-border bg-surface p-4">
          <p className="text-xs text-text-muted">Official you owe</p>
          <p className="mt-1 text-xl font-semibold tabular-nums" data-testid="you-owe">
            {formatMoney(balances.youOwe)}
          </p>
        </div>
        <div className="rounded-md border border-border bg-surface p-4">
          <p className="text-xs text-text-muted">Official you are owed</p>
          <p
            className="mt-1 text-xl font-semibold tabular-nums"
            data-testid="you-are-owed"
          >
            {formatMoney(balances.youAreOwed)}
          </p>
        </div>
        <div className="rounded-md border border-border bg-surface p-4">
          <p className="text-xs text-text-muted">Official net</p>
          <p
            className="mt-1 text-xl font-semibold tabular-nums"
            data-testid="net-position"
          >
            {formatMoney(balances.net)}
          </p>
        </div>
      </section>

      <section
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        data-testid="projected-balances"
      >
        <div className="rounded-md border border-border bg-surface p-4">
          <p className="text-xs text-text-muted">Awaiting confirmation (out)</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {formatMoney(balances.pendingOutgoing ?? 0)}
          </p>
        </div>
        <div className="rounded-md border border-border bg-surface p-4">
          <p className="text-xs text-text-muted">Awaiting confirmation (in)</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {formatMoney(balances.pendingIncoming ?? 0)}
          </p>
        </div>
        <div className="rounded-md border border-border bg-surface p-4">
          <p className="text-xs text-text-muted">Projected you owe</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {formatMoney(balances.projectedYouOwe ?? balances.youOwe)}
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Pairwise
        </h2>
        {settlement.pairwise.length === 0 ? (
          <p className="text-sm text-text-secondary">No pairwise balances.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border bg-surface">
            {settlement.pairwise.map((p) => {
              const purchases = open.filter(
                (o) =>
                  (o.debtor_membership_id === ctx.membershipId &&
                    o.creditor_membership_id === p.counterpartyMembershipId) ||
                  (o.creditor_membership_id === ctx.membershipId &&
                    o.debtor_membership_id === p.counterpartyMembershipId),
              );
              return (
                <li key={p.counterpartyMembershipId} className="space-y-3 px-4 py-3 text-sm">
                  <p className="font-medium">
                    {p.officialNetCents > 0
                      ? `You owe ${label(p.counterpartyMembershipId)} ${formatMoney(p.officialNetCents)}`
                      : `${label(p.counterpartyMembershipId)} owes you ${formatMoney(-p.officialNetCents)}`}
                  </p>
                  {purchases.length > 0 ? (
                    <ul className="space-y-3">
                      {purchases.map((o) => (
                        <li key={o.obligation_id} className="space-y-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <ObligationSourceLinks
                              householdId={householdId}
                              source={sourceFromMaps(o.expense_id, o.obligation_kind, sources)}
                            />
                            <span className="tabular-nums text-text-secondary">
                              {formatMoney(o.official_outstanding_cents)}
                            </span>
                          </div>
                          <Link
                            href={`/app/${householdId}/money/reimbursements/${o.obligation_id}`}
                            className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                          >
                            Balance details
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-xs text-text-muted">
        Confirmed amounts change only after the recipient says they received the
        payment.
      </p>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Open balances
        </h2>
        {open.length === 0 ? (
          <EmptyState
            title="No open reimbursements"
            description="When confirmed expenses create obligations involving you, they will appear here."
          />
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border bg-surface">
            {open.map((o) => (
              <li key={o.obligation_id} className="space-y-2 px-4 py-3.5 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span>
                    {label(o.debtor_membership_id)} → {label(o.creditor_membership_id)}
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatMoney(o.official_outstanding_cents)}
                  </span>
                </div>
                <ObligationSourceLinks
                  householdId={householdId}
                  source={sourceFromMaps(o.expense_id, o.obligation_kind, sources)}
                />
                <Link
                  href={`/app/${householdId}/money/reimbursements/${o.obligation_id}`}
                  className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-2 hover:underline"
                >
                  Balance details
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
