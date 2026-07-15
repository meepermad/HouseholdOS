import Link from "next/link";
import { assertActiveMembership } from "@/lib/household-context";
import { listLedgerEvents } from "@/lib/payments/queries";
import { EmptyState } from "@/components/ui/empty-state";
import { AppBackButton } from "@/components/app-back-button";

export const dynamic = "force-dynamic";

function hrefFor(householdId: string, entityType: string, entityId: string) {
  switch (entityType) {
    case "payment":
      return `/app/${householdId}/money/payments/${entityId}`;
    case "reimbursement_obligation":
      return `/app/${householdId}/money/reimbursements/${entityId}`;
    case "reimbursement_dispute":
      return `/app/${householdId}/money/disputes/${entityId}`;
    case "expense":
      return `/app/${householdId}/money/expenses/${entityId}`;
    default:
      return `/app/${householdId}/money`;
  }
}

export default async function LedgerPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  await assertActiveMembership(householdId);
  const events = await listLedgerEvents(householdId);

  return (
    <main className="space-y-6">
      <AppBackButton fallbackHref={`/app/${householdId}/money`} />
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
        Financial ledger
      </h1>
      <p className="text-sm text-text-secondary">
        Authoritative household financial events. Entries come from source records and
        allowlisted audit events — not free-text edits.
      </p>
      {events.length === 0 ? (
        <EmptyState
          title="No ledger events yet"
          description="Financial activity will appear here as expenses and payments are recorded."
        />
      ) : (
        <ol className="space-y-2">
          {events.map((e) => (
            <li key={e.id}>
              <Link
                href={hrefFor(householdId, e.entity_type, e.entity_id)}
                className="block rounded-md border border-border bg-surface px-4 py-3 text-sm hover:bg-surface-interactive"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium">{e.event_type}</span>
                  <time className="text-xs text-text-muted">
                    {new Date(e.created_at).toLocaleString()}
                  </time>
                </div>
                {e.reason ? (
                  <p className="mt-1 text-text-secondary">{e.reason}</p>
                ) : null}
              </Link>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
