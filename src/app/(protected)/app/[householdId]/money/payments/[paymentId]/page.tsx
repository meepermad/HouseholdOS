import Link from "next/link";
import { notFound } from "next/navigation";
import { assertActiveMembership } from "@/lib/household-context";
import { formatMoney } from "@/lib/expenses/display";
import { listActiveMemberOptions } from "@/lib/expenses/queries";
import { getPaymentDetail } from "@/lib/payments/queries";
import { PaymentStatusBadge } from "@/components/ui/status-badge";
import { AppBackButton } from "@/components/app-back-button";
import {
  CancelPaymentButton,
  IncomingPaymentActions,
  ReversePaymentForm,
} from "@/components/payments/payment-actions";
import { ActionForm } from "@/components/action-form";
import { openDisputeAction } from "@/app/actions/payments";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PaymentDetailPage({
  params,
}: {
  params: Promise<{ householdId: string; paymentId: string }>;
}) {
  const { householdId, paymentId } = await params;
  const ctx = await assertActiveMembership(householdId);
  const [detail, members] = await Promise.all([
    getPaymentDetail(householdId, paymentId),
    listActiveMemberOptions(householdId),
  ]);
  if (!detail) notFound();

  const { payment, allocations, privateDetails, reversal } = detail;
  const label = (id: string) =>
    members.find((m) => m.id === id)?.label ?? id.slice(0, 8);

  const isRecipient = ctx.membershipId === payment.recipient_membership_id;
  const isSender = ctx.membershipId === payment.sender_membership_id;

  const supabase = await createClient();
  const obligationIds = allocations.map((a) => a.obligation_id);
  const { data: obls } =
    obligationIds.length > 0
      ? await supabase
          .from("reimbursement_obligations")
          .select("id, expense_id")
          .in("id", obligationIds)
      : { data: [] as { id: string; expense_id: string }[] };

  const expenseByObl = new Map((obls ?? []).map((o) => [o.id, o.expense_id]));

  return (
    <main className="space-y-6">
      <AppBackButton fallbackHref={`/app/${householdId}/money/payments`} />
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            {formatMoney(payment.total_amount_cents)}
          </h1>
          <PaymentStatusBadge status={payment.status} />
        </div>
        <p className="text-sm text-text-secondary">
          {label(payment.sender_membership_id)} → {label(payment.recipient_membership_id)}
          {" · "}
          Recorded as {payment.external_method.replaceAll("_", " ")}
        </p>
      </header>

      <section className="space-y-1 rounded-md border border-border bg-surface p-4 text-sm">
        <p>
          <span className="text-text-muted">Submitted: </span>
          {payment.submitted_at
            ? new Date(payment.submitted_at).toLocaleString()
            : "—"}
        </p>
        {payment.confirmed_at ? (
          <p>
            Confirmed received by {label(payment.confirmed_by_membership_id ?? "")} at{" "}
            {new Date(payment.confirmed_at).toLocaleString()}
          </p>
        ) : null}
        {payment.rejected_at ? (
          <p>
            Rejected: {payment.rejection_reason} (
            {new Date(payment.rejected_at).toLocaleString()})
          </p>
        ) : null}
        {payment.cancelled_at ? (
          <p>Cancelled {new Date(payment.cancelled_at).toLocaleString()}</p>
        ) : null}
        {payment.reversed_at && reversal ? (
          <p>
            Reversed {new Date(payment.reversed_at).toLocaleString()}: {reversal.reason}
          </p>
        ) : null}
        {payment.public_note ? <p>Note: {payment.public_note}</p> : null}
        {privateDetails?.private_note ? (
          <p data-testid="private-note">Private note: {privateDetails.private_note}</p>
        ) : null}
        {privateDetails?.external_reference ? (
          <p data-testid="external-reference">
            Private reference: {privateDetails.external_reference}
          </p>
        ) : null}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Allocations
        </h2>
        <ul className="divide-y divide-border rounded-md border border-border bg-surface">
          {allocations.map((a) => (
            <li key={a.id} className="flex justify-between gap-2 px-4 py-3 text-sm">
              <Link
                href={`/app/${householdId}/money/reimbursements/${a.obligation_id}`}
                className="underline"
              >
                Obligation {a.obligation_id.slice(0, 8)}…
              </Link>
              <span className="tabular-nums">{formatMoney(a.amount_cents)}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2 text-sm">
          {[...new Set([...expenseByObl.values()])].map((expenseId) => (
            <Link
              key={expenseId}
              href={`/app/${householdId}/money/expenses/${expenseId}`}
              className="underline"
            >
              Related expense
            </Link>
          ))}
        </div>
      </section>

      {payment.status === "submitted" && isRecipient ? (
        <IncomingPaymentActions householdId={householdId} paymentId={paymentId} />
      ) : null}
      {payment.status === "submitted" && isSender ? (
        <CancelPaymentButton householdId={householdId} paymentId={paymentId} />
      ) : null}
      {payment.status === "confirmed" && isRecipient ? (
        <ReversePaymentForm householdId={householdId} paymentId={paymentId} />
      ) : null}

      <ActionForm action={openDisputeAction} pendingLabel="Opening dispute…">
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="paymentId" value={paymentId} />
        <input type="hidden" name="disputeType" value="payment_not_received" />
        <label className="block text-sm font-medium" htmlFor="dispute-reason">
          Open dispute
        </label>
        <textarea
          id="dispute-reason"
          name="reason"
          required
          className="mt-1 min-h-20 w-full rounded-md border border-border bg-surface px-3 py-2"
        />
        <button
          type="submit"
          className="mt-2 inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-semibold"
        >
          Open dispute
        </button>
      </ActionForm>
    </main>
  );
}
