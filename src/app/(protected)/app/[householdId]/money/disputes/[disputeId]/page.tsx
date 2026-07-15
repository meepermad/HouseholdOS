import { notFound } from "next/navigation";
import { assertActiveMembership } from "@/lib/household-context";
import { getDisputeDetail } from "@/lib/payments/queries";
import { PaymentStatusBadge } from "@/components/ui/status-badge";
import { AppBackButton } from "@/components/app-back-button";
import { ActionForm } from "@/components/action-form";
import {
  resolveDisputeAction,
  withdrawDisputeAction,
} from "@/app/actions/payments";

export const dynamic = "force-dynamic";

export default async function DisputeDetailPage({
  params,
}: {
  params: Promise<{ householdId: string; disputeId: string }>;
}) {
  const { householdId, disputeId } = await params;
  const ctx = await assertActiveMembership(householdId);
  const detail = await getDisputeDetail(householdId, disputeId);
  if (!detail) notFound();
  const { dispute, events } = detail;
  const open = dispute.status === "open" || dispute.status === "under_review";

  return (
    <main className="space-y-6">
      <AppBackButton fallbackHref={`/app/${householdId}/money/disputes`} />
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            Dispute
          </h1>
          <PaymentStatusBadge status={dispute.status} />
        </div>
        <p className="text-sm text-text-secondary">
          {dispute.dispute_type.replaceAll("_", " ")}
        </p>
        <p className="text-sm">{dispute.reason}</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Timeline
        </h2>
        <ul className="space-y-2 text-sm">
          {events.map((e) => (
            <li key={e.id} className="rounded-md border border-border bg-surface px-3 py-2">
              <p className="font-medium">{e.event_type}</p>
              {e.note ? <p>{e.note}</p> : null}
              <p className="text-xs text-text-muted">
                {new Date(e.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {open ? (
        <>
          <ActionForm action={resolveDisputeAction} pendingLabel="Resolving dispute…">
            <input type="hidden" name="householdId" value={householdId} />
            <input type="hidden" name="disputeId" value={disputeId} />
            <label className="block text-sm font-medium" htmlFor="resolutionType">
              Resolution type
            </label>
            <select
              id="resolutionType"
              name="resolutionType"
              className="mt-1 min-h-11 w-full rounded-md border border-border bg-surface px-3"
              required
            >
              <option value="no_change">No change</option>
              <option value="payment_rejection">Payment rejection</option>
              <option value="payment_reversal">Payment reversal</option>
              <option value="waiver">Waiver</option>
              <option value="expense_amendment">Expense amendment</option>
              <option value="expense_void">Expense void</option>
            </select>
            <label className="mt-2 block text-sm font-medium" htmlFor="resolutionNote">
              Resolution note
            </label>
            <textarea
              id="resolutionNote"
              name="resolutionNote"
              required
              className="mt-1 min-h-20 w-full rounded-md border border-border bg-surface px-3 py-2"
            />
            <button
              type="submit"
              className="mt-2 inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              Resolve dispute
            </button>
          </ActionForm>

          {ctx.membershipId === dispute.raised_by_membership_id ? (
            <ActionForm action={withdrawDisputeAction} pendingLabel="Withdrawing dispute…">
              <input type="hidden" name="householdId" value={householdId} />
              <input type="hidden" name="disputeId" value={disputeId} />
              <button
                type="submit"
                className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-semibold"
              >
                Withdraw dispute
              </button>
            </ActionForm>
          ) : null}
        </>
      ) : null}

      {dispute.resolution_type ? (
        <p className="text-sm text-text-secondary">
          Resolved as {dispute.resolution_type.replaceAll("_", " ")}
          {dispute.resolution_note ? `: ${dispute.resolution_note}` : ""}
        </p>
      ) : null}
    </main>
  );
}
