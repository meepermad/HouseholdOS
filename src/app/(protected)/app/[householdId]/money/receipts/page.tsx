import Link from "next/link";
import { assertActiveMembership } from "@/lib/household-context";
import { AppBackButton } from "@/components/app-back-button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getLaunchFeatureReadiness,
  launchFeatureUnavailableMessage,
} from "@/lib/launch/feature-readiness";
import { LaunchFeatureUnavailable } from "@/components/launch/LaunchFeatureUnavailable";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ReceiptRow = {
  id: string;
  merchant_corrected: string | null;
  status: string;
  created_at: string;
  declared_total_cents: number | null;
};

export default async function ReceiptDraftsPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  await assertActiveMembership(householdId);
  const launch = await getLaunchFeatureReadiness();
  const unavailable = launchFeatureUnavailableMessage("receipts", launch);
  if (unavailable) {
    return (
      <main className="space-y-6" data-testid="receipt-drafts">
        <AppBackButton fallbackHref={`/app/${householdId}/money`} />
        <LaunchFeatureUnavailable title="Receipts not ready" message={unavailable} />
      </main>
    );
  }

  const supabase = await createClient();
  const { data: receipts, error } = await supabase
    .from("expense_receipts")
    .select("id, merchant_corrected, status, created_at, declared_total_cents")
    .eq("household_id", householdId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    return (
      <main className="space-y-6" data-testid="receipt-drafts">
        <AppBackButton fallbackHref={`/app/${householdId}/money`} />
        <LaunchFeatureUnavailable
          title="Could not load receipts"
          message={error.message}
        />
      </main>
    );
  }

  const rows = (receipts ?? []) as ReceiptRow[];

  return (
    <main className="space-y-6" data-testid="receipt-drafts">
      <AppBackButton fallbackHref={`/app/${householdId}/money`} />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl text-text-primary">
            Receipt drafts
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Review-first captures waiting for confirmation. Only receipts you are
            authorized to see appear here.
          </p>
        </div>
        <Link
          href={`/app/${householdId}/money/receipts/new`}
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Scan receipt
        </Link>
      </header>

      {rows.length === 0 ? (
        <EmptyState
          title="No receipts yet"
          description="Scan a receipt to propose merchant, totals, and line items."
        />
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border bg-surface">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/app/${householdId}/money/receipts/${r.id}`}
                className="flex min-h-11 items-center justify-between gap-3 px-3 py-3 text-sm hover:bg-muted/40"
              >
                <span className="font-medium text-text-primary">
                  {r.merchant_corrected ?? "Untitled receipt"}
                </span>
                <span className="text-xs text-text-muted">
                  {r.status} · {new Date(r.created_at).toLocaleDateString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
