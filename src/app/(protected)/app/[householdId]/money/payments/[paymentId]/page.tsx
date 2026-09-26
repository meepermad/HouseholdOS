import Link from "next/link";
import { notFound } from "next/navigation";
import { assertActiveMembership } from "@/lib/household-context";
import { formatMoney } from "@/lib/expenses/display";
import { listActiveMemberOptions } from "@/lib/expenses/queries";
import { getPaymentDetail } from "@/lib/payments/queries";
import { PaymentStatusBadge } from "@/components/ui/status-badge";
import { AppBackButton } from "@/components/app-back-button";
import {
  AssociatePayerReportForm,
  CancelPaymentButton,
  IncomingPaymentActions,
  ReversePaymentForm,
} from "@/components/payments/payment-actions";
import { describePaymentRecord } from "@/lib/payments/narrative";
import { loadObligationPurchaseSources } from "@/lib/payments/queries";
import { obligationPurchaseLabel, sourceFromMaps } from "@/lib/payments/obligation-source";
import { ActionForm } from "@/components/action-form";
import { openDisputeAction } from "@/app/actions/payments";
import { createClient } from "@/lib/supabase/server";
import { paymentMethodLabel } from "@/lib/presentation/human-status";

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
          .select("id, expense_id, obligation_kind")
          .in("id", obligationIds)
      : { data: [] as { id: string; expense_id: string | null; obligation_kind: string }[] };

  const expenseByObl = new Map(
    (obls ?? []).map((o) => [o.id, { expenseId: o.expense_id, kind: o.obligation_kind }]),
  );
  const sources = await loadObligationPurchaseSources(
    householdId,
    [...expenseByObl.values()].map((row) => row.expenseId),
  );
  const narrative = describePaymentRecord({
    status: payment.status,
    amountCents: payment.total_amount_cents,
    senderName: label(payment.sender_membership_id),
    recipientName: label(payment.recipient_membership_id),
    senderMembershipId: payment.sender_membership_id,
    recipientMembershipId: payment.recipient_membership_id,
    createdByMembershipId: payment.created_by_membership_id,
  });
  const recipientRecorded =
    payment.created_by_membership_id !== payment.sender_membership_id;

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
        <p className="text-sm text-text-secondary" data-testid="payment-narrative">
          {narrative} Recorded as {paymentMethodLabel(payment.external_method)}. HouseholdOS
          does not verify the outside payment.
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
          <p data-testid="payment-acknowledgment">
            {recipientRecorded
              ? `${label(payment.confirmed_by_membership_id ?? "")} recorded receiving this payment at ${new Date(payment.confirmed_at).toLocaleString()}.`
              : `${label(payment.confirmed_by_membership_id ?? "")} acknowledged receiving this payment at ${new Date(payment.confirmed_at).toLocaleString()}.`}{" "}
            This is their record of receipt. HouseholdOS did not verify an outside account.
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
          Applied to
        </h2>
        <ul className="divide-y divide-border rounded-md border border-border bg-surface">
          {allocations.map((a) => {
            const source = sourceFromMaps(
              expenseByObl.get(a.obligation_id)?.expenseId ?? null,
              expenseByObl.get(a.obligation_id)?.kind ?? "reimbursement",
              sources,
            );
            return (
              <li key={a.id} className="space-y-1 px-4 py-3 text-sm">
                <div className="flex justify-between gap-2">
                  <Link
                    href={`/app/${householdId}/money/reimbursements/${a.obligation_id}`}
                    className="underline"
                  >
                    {obligationPurchaseLabel(source)}
                  </Link>
                  <span className="tabular-nums">{formatMoney(a.amount_cents)}</span>
                </div>
                <p className="flex flex-wrap gap-x-3 text-xs">
                  {source.expenseId ? (
                    <Link
                      href={`/app/${householdId}/money/expenses/${source.expenseId}`}
                      className="font-medium text-primary underline-offset-2 hover:underline"
                    >
                      Original expense
                    </Link>
                  ) : null}
                  {source.receiptId ? (
                    <Link
                      href={`/app/${householdId}/money/receipts/${source.receiptId}`}
                      className="font-medium text-primary underline-offset-2 hover:underline"
                    >
                      Receipt and items
                    </Link>
                  ) : (
                    <span className="text-text-muted">No receipt is attached.</span>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap gap-2 text-sm">
          {[...new Set([...expenseByObl.values()].map((row) => row.expenseId).filter(Boolean))].map((expenseId) => (
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
      {payment.status === "confirmed" && isSender ? (
        <AssociatePayerReportForm householdId={householdId} paymentId={paymentId} />
      ) : null}

      <ActionForm action={openDisputeAction} pendingLabel="Opening dispute…">
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="paymentId" value={paymentId} />
        <input type="hidden" name="disputeType" value="payment_not_received" />
        <label className="block text-sm font-medium" htmlFor="dispute-reason">
          Report a problem
        </label>
        <p className="text-xs text-text-muted">
          Reporting a problem does not undo the balance. A correction is recorded separately
          and the original payment stays in the history.
          {recipientRecorded && isSender
            ? ` ${label(payment.created_by_membership_id)} recorded this receipt.`
            : ""}
        </p>
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
          Report a problem
        </button>
      </ActionForm>
    </main>
  );
}
