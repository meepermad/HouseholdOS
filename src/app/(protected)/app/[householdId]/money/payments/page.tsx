import Link from "next/link";
import { assertActiveMembership } from "@/lib/household-context";
import { formatMoney } from "@/lib/expenses/display";
import { listActiveMemberOptions } from "@/lib/expenses/queries";
import { listPayments } from "@/lib/payments/queries";
import { PaymentStatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AppBackButton } from "@/components/app-back-button";

export const dynamic = "force-dynamic";

export default async function PaymentsPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  await assertActiveMembership(householdId);
  const [payments, members] = await Promise.all([
    listPayments(householdId),
    listActiveMemberOptions(householdId),
  ]);
  const label = (id: string) =>
    members.find((m) => m.id === id)?.label ?? id.slice(0, 8);

  return (
    <main className="space-y-6">
      <AppBackButton fallbackHref={`/app/${householdId}/money`} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Payments
        </h1>
        <Link
          href={`/app/${householdId}/money/payments/new`}
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Record payment
        </Link>
      </div>
      <p className="text-sm text-text-secondary">
        HouseholdOS records external payments. It does not move money or verify providers.
      </p>
      {payments.length === 0 ? (
        <EmptyState
          title="No payments recorded"
          description="When someone records an external payment toward reimbursements, it will appear here."
          action={
            <Link
              href={`/app/${householdId}/money/payments/new`}
              className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              Start settle-up
            </Link>
          }
        />
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border bg-surface">
          {payments.map((p) => (
            <li key={p.id}>
              <Link
                href={`/app/${householdId}/money/payments/${p.id}`}
                className="flex flex-col gap-2 px-4 py-3.5 text-sm hover:bg-surface-interactive sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="space-y-1">
                  <span className="block font-medium">
                    {label(p.sender_membership_id)} → {label(p.recipient_membership_id)}
                  </span>
                  <PaymentStatusBadge status={p.status} />
                </span>
                <span className="tabular-nums font-medium">
                  {formatMoney(p.total_amount_cents)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
