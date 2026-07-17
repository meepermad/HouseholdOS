import Link from "next/link";
import { assertActiveMembership } from "@/lib/household-context";
import { AppBackButton } from "@/components/app-back-button";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedDb = any;

export default async function ReceiptDraftsPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  await assertActiveMembership(householdId);
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = (await createClient()) as UntypedDb;
  const { data: receipts } = await supabase
    .from("expense_receipts")
    .select("id, merchant_corrected, status, created_at, declared_total_cents")
    .eq("household_id", householdId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(40);

  return (
    <main className="space-y-6" data-testid="receipt-drafts">
      <AppBackButton fallbackHref={`/app/${householdId}/money`} />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl text-text-primary">
            Receipt drafts
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Review-first captures waiting for confirmation.
          </p>
        </div>
        <Link
          href={`/app/${householdId}/money/receipts/new`}
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Scan receipt
        </Link>
      </header>

      {(receipts ?? []).length === 0 ? (
        <EmptyState
          title="No receipts yet"
          description="Scan a receipt to propose merchant, totals, and line items."
        />
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border bg-surface">
          {(receipts ?? []).map(
            (r: {
              id: string;
              merchant_corrected: string | null;
              status: string;
              created_at: string;
              declared_total_cents: number | null;
            }) => (
              <li key={r.id}>
                <Link
                  href={`/app/${householdId}/money/receipts/${r.id}`}
                  className="flex min-h-11 items-center justify-between px-4 py-3 text-sm hover:bg-surface-interactive"
                >
                  <span>
                    <span className="font-medium">
                      {r.merchant_corrected || "Receipt"}
                    </span>
                    <span className="ml-2 text-xs text-text-muted">{r.status}</span>
                  </span>
                  <span className="tabular-nums text-text-secondary">
                    {r.declared_total_cents != null
                      ? `$${(r.declared_total_cents / 100).toFixed(2)}`
                      : "—"}
                  </span>
                </Link>
              </li>
            ),
          )}
        </ul>
      )}
    </main>
  );
}
