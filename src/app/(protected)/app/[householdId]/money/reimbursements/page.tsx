import Link from "next/link";
import { assertActiveMembership } from "@/lib/household-context";
import { formatMoney } from "@/lib/expenses/display";
import { listActiveMemberOptions } from "@/lib/expenses/queries";
import {
  listObligationBalances,
  loadObligationPurchaseSources,
} from "@/lib/payments/queries";
import { SettlementStatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AppBackButton } from "@/components/app-back-button";
import {
  ObligationSourceLinks,
} from "@/components/payments/ObligationSourceLinks";
import { sourceFromMaps } from "@/lib/payments/obligation-source";

export const dynamic = "force-dynamic";

export default async function ReimbursementsPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const ctx = await assertActiveMembership(householdId);
  const [rows, members] = await Promise.all([
    listObligationBalances(householdId),
    listActiveMemberOptions(householdId),
  ]);
  const sources = await loadObligationPurchaseSources(
    householdId,
    rows.map((r) => r.expense_id),
  );
  const label = (id: string) =>
    members.find((m) => m.id === id)?.label ?? id.slice(0, 8);

  const youOwe = rows.filter(
    (r) =>
      r.debtor_membership_id === ctx.membershipId &&
      r.official_outstanding_cents + r.pending_payment_cents > 0,
  );
  const owedToYou = rows.filter(
    (r) =>
      r.creditor_membership_id === ctx.membershipId &&
      r.official_outstanding_cents + r.pending_payment_cents > 0,
  );

  return (
    <main className="space-y-6">
      <AppBackButton fallbackHref={`/app/${householdId}/money`} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          What people owe
        </h1>
        <Link
          href={`/app/${householdId}/money/payments/new`}
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Record payment
        </Link>
      </div>

      <ObligationList
        title="You owe"
        rows={youOwe}
        householdId={householdId}
        label={label}
        empty="You have no outstanding obligations."
        sources={sources}
      />
      <ObligationList
        title="Owed to you"
        rows={owedToYou}
        householdId={householdId}
        label={label}
        empty="No one currently owes you an official balance."
        sources={sources}
      />
    </main>
  );
}

function ObligationList({
  title,
  rows,
  householdId,
  label,
  empty,
  sources,
}: {
  title: string;
  rows: Awaited<ReturnType<typeof listObligationBalances>>;
  householdId: string;
  label: (id: string) => string;
  empty: string;
  sources: Awaited<ReturnType<typeof loadObligationPurchaseSources>>;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
        {title}
      </h2>
      {rows.length === 0 ? (
        <EmptyState title={empty} description="Nothing to show in this list right now." />
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border bg-surface">
          {rows.map((r) => (
            <li key={r.obligation_id} className="space-y-2 px-4 py-3.5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {label(r.debtor_membership_id)} → {label(r.creditor_membership_id)}
                  {r.obligation_kind === "refund" ? " (refund)" : ""}
                </span>
                <SettlementStatusBadge status={r.settlement_state} />
              </div>
              <p className="tabular-nums">
                Still owed {formatMoney(r.official_outstanding_cents)}
                {r.pending_payment_cents > 0
                  ? ` · Waiting for confirmation ${formatMoney(r.pending_payment_cents)}`
                  : ""}
              </p>
              <ObligationSourceLinks
                householdId={householdId}
                source={sourceFromMaps(r.expense_id, r.obligation_kind, sources)}
              />
              <Link
                href={`/app/${householdId}/money/reimbursements/${r.obligation_id}`}
                className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-2 hover:underline"
              >
                Balance details
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
