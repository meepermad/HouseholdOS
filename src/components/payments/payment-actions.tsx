"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import {
  associatePayerReportAction,
  cancelPaymentAction,
  confirmPaymentAction,
  rejectPaymentAction,
  reversePaymentAction,
} from "@/app/actions/payments";

export function IncomingPaymentActions({
  householdId,
  paymentId,
}: {
  householdId: string;
  paymentId: string;
}) {
  return (
    <div className="space-y-4" data-testid="incoming-confirmation">
      <ActionForm action={confirmPaymentAction} pendingLabel="Confirming receipt…">
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="paymentId" value={paymentId} />
        <p className="text-sm text-text-secondary">
          By confirming, you attest that you received this external payment. HouseholdOS
          does not verify payment providers.
        </p>
        <button
          type="submit"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
          data-testid="confirm-receipt"
        >
          Confirm payment received
        </button>
      </ActionForm>

      <ActionForm action={rejectPaymentAction} pendingLabel="Rejecting payment…">
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="paymentId" value={paymentId} />
        <label className="block text-sm font-medium" htmlFor="reject-reason">
          Rejection reason
        </label>
        <select
          id="reject-reason"
          name="reason"
          className="mt-1 min-h-11 w-full rounded-md border border-border bg-surface px-3"
          required
          data-testid="reject-reason"
        >
          <option value="Payment not received">Payment not received</option>
          <option value="Amount incorrect">Amount incorrect</option>
          <option value="Wrong recipient">Wrong recipient</option>
          <option value="Duplicate payment">Duplicate payment</option>
          <option value="Allocation incorrect">Allocation incorrect</option>
          <option value="Other">Other</option>
        </select>
        <button
          type="submit"
          className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border px-4 text-sm font-semibold"
          data-testid="reject-payment"
        >
          Reject payment
        </button>
      </ActionForm>
    </div>
  );
}

export function CancelPaymentButton({
  householdId,
  paymentId,
}: {
  householdId: string;
  paymentId: string;
}) {
  return (
    <ActionForm action={cancelPaymentAction} pendingLabel="Cancelling payment…">
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="paymentId" value={paymentId} />
      <button
        type="submit"
        className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-semibold"
        data-testid="cancel-payment"
      >
        Cancel submitted payment
      </button>
    </ActionForm>
  );
}

export function AssociatePayerReportForm({
  householdId,
  paymentId,
}: {
  householdId: string;
  paymentId: string;
}) {
  const [key] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `assoc-${paymentId}`,
  );
  return (
    <ActionForm action={associatePayerReportAction} pendingLabel="Saving your note…" actionCategory="financial">
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="paymentId" value={paymentId} />
      <input type="hidden" name="idempotencyKey" value={key} />
      <p className="text-sm text-text-secondary">
        This receipt is already recorded. Adding your note does not create another settlement.
      </p>
      <label className="mt-2 block text-sm font-medium" htmlFor="payer-note">
        Your note (optional)
      </label>
      <textarea
        id="payer-note"
        name="note"
        className="mt-1 min-h-20 w-full rounded-md border border-border bg-surface px-3 py-2"
        maxLength={500}
      />
      <button
        type="submit"
        className="mt-2 inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-semibold"
        data-testid="associate-payer-report"
      >
        Associate your report
      </button>
    </ActionForm>
  );
}

export function ReversePaymentForm({
  householdId,
  paymentId,
}: {
  householdId: string;
  paymentId: string;
}) {
  return (
    <ActionForm action={reversePaymentAction} pendingLabel="Reversing payment…">
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="paymentId" value={paymentId} />
      <label className="block text-sm font-medium" htmlFor="reverse-reason">
        Reversal reason
      </label>
      <textarea
        id="reverse-reason"
        name="reason"
        required
        className="mt-1 min-h-20 w-full rounded-md border border-border bg-surface px-3 py-2"
        data-testid="reverse-reason"
      />
      <button
        type="submit"
        className="mt-2 inline-flex min-h-11 items-center rounded-md border border-danger px-4 text-sm font-semibold text-danger"
        data-testid="reverse-payment"
      >
        Reverse confirmed payment
      </button>
    </ActionForm>
  );
}
