import Link from "next/link";
import { assertActiveMembership } from "@/lib/household-context";
import { listDisputes } from "@/lib/payments/queries";
import { PaymentStatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AppBackButton } from "@/components/app-back-button";

export const dynamic = "force-dynamic";

export default async function DisputesPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  await assertActiveMembership(householdId);
  const disputes = await listDisputes(householdId);

  return (
    <main className="space-y-6">
      <AppBackButton fallbackHref={`/app/${householdId}/money`} />
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
        Disputes
      </h1>
      <p className="text-sm text-text-secondary">
        Disputes do not change money by themselves. Resolution must link to an explicit
        financial action.
      </p>
      {disputes.length === 0 ? (
        <EmptyState
          title="No disputes"
          description="Open a dispute from a payment, obligation, or expense when something looks wrong."
        />
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border bg-surface">
          {disputes.map((d) => (
            <li key={d.id}>
              <Link
                href={`/app/${householdId}/money/disputes/${d.id}`}
                className="flex flex-col gap-2 px-4 py-3.5 text-sm hover:bg-surface-interactive sm:flex-row sm:items-center sm:justify-between"
              >
                <span>
                  <span className="font-medium">{d.dispute_type.replaceAll("_", " ")}</span>
                  <span className="mt-1 block text-text-secondary line-clamp-2">
                    {d.reason}
                  </span>
                </span>
                <PaymentStatusBadge status={d.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
