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
import { formatCentsAsUsd } from "@/lib/receipts/currency";
import { receiptDraftHeadline } from "@/lib/receipts/draft-status";

export const dynamic = "force-dynamic";

type ReceiptRow = {
  id: string;
  merchant_corrected: string | null;
  status: string;
  created_at: string;
  declared_total_cents: number | null;
  ocr_outcome: string | null;
  uploaded_by_membership_id: string;
  payer_membership_id: string | null;
};

type InviteRow = { receipt_id: string; membership_id: string; status: string };

export default async function ReceiptDraftsPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const ctx = await assertActiveMembership(householdId);
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: receipts, error } = await db
    .from("expense_receipts")
    .select(
      "id, merchant_corrected, status, created_at, declared_total_cents, ocr_outcome, uploaded_by_membership_id, payer_membership_id",
    )
    .eq("household_id", householdId)
    .is("deleted_at", null)
    .neq("status", "confirmed")
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    return (
      <main className="space-y-6" data-testid="receipt-drafts">
        <AppBackButton fallbackHref={`/app/${householdId}/money`} />
        <LaunchFeatureUnavailable
          title="Could not load receipts"
          message="Receipt drafts could not be loaded right now."
        />
      </main>
    );
  }

  const rows = (receipts ?? []) as ReceiptRow[];
  const ids = rows.map((r) => r.id);
  const { data: invites } = ids.length
    ? await db
        .from("expense_receipt_claim_invites")
        .select("receipt_id, membership_id, status")
        .in("receipt_id", ids)
    : { data: [] as InviteRow[] };
  const inviteRows = (invites ?? []) as InviteRow[];

  return (
    <main className="space-y-6" data-testid="receipt-drafts">
      <AppBackButton fallbackHref={`/app/${householdId}/money`} />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl text-text-primary">
            Receipt drafts
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Receipts that still need claiming, review, or a manual total.
          </p>
        </div>
        <Link
          href={`/app/${householdId}/money/receipts/new`}
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Add receipt
        </Link>
      </header>

      {rows.length === 0 ? (
        <EmptyState
          title="No open receipts"
          description="Scan a receipt to split it with your roommates."
          action={
            <Link
              href={`/app/${householdId}/money/receipts/new`}
              className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Add receipt
            </Link>
          }
        />
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border bg-surface">
          {rows.map((r) => {
            const waiting = inviteRows.filter(
              (i) => i.receipt_id === r.id && i.status === "waiting",
            ).length;
            const needsClaim = inviteRows.some(
              (i) =>
                i.receipt_id === r.id &&
                i.membership_id === ctx.membershipId &&
                i.status === "waiting",
            );
            const copy = receiptDraftHeadline({
              status: r.status,
              ocrOutcome: r.ocr_outcome,
              waitingCount: waiting,
              isPayer:
                ctx.membershipId ===
                (r.payer_membership_id ?? r.uploaded_by_membership_id),
              currentUserNeedsToClaim: needsClaim,
            });
            const href =
              copy.action === "claim_mine"
                ? `/app/${householdId}/money/receipts/${r.id}?claim=1`
                : `/app/${householdId}/money/receipts/${r.id}`;
            const cta =
              copy.action === "claim_mine"
                ? "Claim mine"
                : copy.action === "retry_reading"
                  ? "Retry reading"
                  : copy.action === "enter_manually"
                    ? "Enter manually"
                    : copy.action === "review"
                      ? "Review"
                      : "Continue";
            return (
              <li key={r.id}>
                <Link
                  href={href}
                  className="flex min-h-14 items-center justify-between gap-3 px-3 py-3 text-sm hover:bg-muted/40"
                >
                  <span>
                    <span className="block font-medium text-text-primary">
                      {r.merchant_corrected ?? "Untitled receipt"}
                    </span>
                    <span className="block text-xs text-text-muted">
                      {new Date(r.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                      {r.declared_total_cents
                        ? ` · ${formatCentsAsUsd(r.declared_total_cents)}`
                        : ""}
                      {` · ${copy.title}`}
                    </span>
                  </span>
                  <span className="shrink-0 font-medium text-primary">{cta}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
