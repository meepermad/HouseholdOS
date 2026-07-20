"use client";

import { useActionState, useState } from "react";
import type { ActionResult } from "@/app/actions/auth";
import {
  acceptRoutedRecipientAction,
  approveRoutedIntermediaryAction,
  cancelRoutedSettlementAction,
  confirmRoutedSettlementAction,
  requestRoutedCorrectionAction,
  respondRoutedCorrectionAction,
  submitRoutedPaymentAction,
} from "@/app/actions/routed-settlements";

function makeIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `route-pay-${Math.random().toString(36).slice(2)}`;
}

export function RoutedProposalActions({
  householdId,
  proposalId,
  status,
  role,
  correction,
}: {
  householdId: string;
  proposalId: string;
  status: string;
  role: "payer" | "intermediary" | "recipient" | "other";
  correction?: {
    id: string;
    status: string;
  } | null;
}) {
  return (
    <div className="space-y-4" data-testid="routed-proposal-actions">
      {role === "intermediary" && status === "awaiting_intermediary_approval" ? (
        <DecisionForm
          householdId={householdId}
          proposalId={proposalId}
          action={approveRoutedIntermediaryAction}
          approveValue="approved"
          rejectValue="rejected"
          approveLabel="Approve as intermediary"
          rejectLabel="Reject"
        />
      ) : null}
      {role === "recipient" && status === "awaiting_recipient_acceptance" ? (
        <DecisionForm
          householdId={householdId}
          proposalId={proposalId}
          action={acceptRoutedRecipientAction}
          approveValue="accepted"
          rejectValue="rejected"
          approveLabel="Accept routed payment"
          rejectLabel="Reject"
        />
      ) : null}
      {role === "payer" && status === "ready_to_pay" ? (
        <SubmitPayForm householdId={householdId} proposalId={proposalId} />
      ) : null}
      {role === "recipient" && status === "submitted" ? (
        <SimpleAction
          householdId={householdId}
          proposalId={proposalId}
          action={confirmRoutedSettlementAction}
          label="Confirm receipt"
          testId="confirm-routed-settlement"
        />
      ) : null}
      {(role === "payer" || role === "other") &&
      [
        "awaiting_intermediary_approval",
        "awaiting_recipient_acceptance",
        "ready_to_pay",
      ].includes(status) ? (
        <SimpleAction
          householdId={householdId}
          proposalId={proposalId}
          action={cancelRoutedSettlementAction}
          label="Cancel proposal"
          testId="cancel-routed-settlement"
          danger
        />
      ) : null}

      {status === "confirmed" &&
      role !== "other" &&
      (!correction ||
        ["declined", "disputed", "cancelled"].includes(correction.status)) ? (
        <RequestCorrectionForm householdId={householdId} proposalId={proposalId} />
      ) : null}

      {correction &&
      correction.status === "awaiting_recipient" &&
      role === "recipient" ? (
        <CorrectionRecipientForm
          householdId={householdId}
          requestId={correction.id}
        />
      ) : null}

      {correction &&
      correction.status === "awaiting_participants" &&
      (role === "payer" || role === "intermediary") ? (
        <CorrectionParticipantForm
          householdId={householdId}
          requestId={correction.id}
        />
      ) : null}

      {correction ? (
        <p className="text-sm text-text-muted" data-testid="routed-correction-status">
          Correction status: {correction.status}
        </p>
      ) : null}
    </div>
  );
}

function RequestCorrectionForm({
  householdId,
  proposalId,
}: {
  householdId: string;
  proposalId: string;
}) {
  const [state, action, pending] = useActionState(requestRoutedCorrectionAction, null);
  return (
    <form
      action={action}
      className="space-y-3 rounded-md border border-border p-3"
      data-testid="request-routed-correction"
    >
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="proposalId" value={proposalId} />
      <p className="text-sm text-text-muted">
        Correcting a confirmed route requires recipient confirmation that the external
        payment was returned, then payer and intermediary approval. The linked payment is
        reversed before both obligation legs are restored.
      </p>
      <label className="block text-sm">
        Correction path
        <select
          name="correctionPath"
          required
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
          defaultValue="external_payment_returned"
        >
          <option value="external_payment_returned">External payment returned</option>
          <option value="payment_confirmation_disputed">Payment confirmation disputed</option>
          <option value="accounting_correction">Accounting correction</option>
          <option value="administrative_correction">Administrative correction</option>
        </select>
      </label>
      <label className="block text-sm">
        Reason
        <textarea
          name="reason"
          required
          minLength={3}
          rows={3}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
        />
      </label>
      {state && !state.ok ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-semibold"
      >
        Request correction
      </button>
    </form>
  );
}

function CorrectionRecipientForm({
  householdId,
  requestId,
}: {
  householdId: string;
  requestId: string;
}) {
  const [state, action, pending] = useActionState(respondRoutedCorrectionAction, null);
  return (
    <div className="space-y-2" data-testid="correction-recipient-actions">
      {state && !state.ok ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      {(
        [
          ["confirmed_return", "Confirm money was returned"],
          ["declined_return", "Decline — money was not returned"],
          ["disputed_receipt", "Dispute original receipt"],
        ] as const
      ).map(([decision, label]) => (
        <form key={decision} action={action}>
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="decision" value={decision} />
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-semibold"
          >
            {label}
          </button>
        </form>
      ))}
    </div>
  );
}

function CorrectionParticipantForm({
  householdId,
  requestId,
}: {
  householdId: string;
  requestId: string;
}) {
  const [state, action, pending] = useActionState(respondRoutedCorrectionAction, null);
  return (
    <div className="space-y-2" data-testid="correction-participant-actions">
      {state && !state.ok ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <form action={action} className="flex flex-wrap gap-2">
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="decision" value="approved" />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Approve correction
        </button>
      </form>
      <form action={action}>
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="decision" value="declined" />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-semibold"
        >
          Decline correction
        </button>
      </form>
    </div>
  );
}

function DecisionForm({
  householdId,
  proposalId,
  action,
  approveValue,
  rejectValue,
  approveLabel,
  rejectLabel,
}: {
  householdId: string;
  proposalId: string;
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  approveValue: string;
  rejectValue: string;
  approveLabel: string;
  rejectLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <div className="space-y-2">
      {state && !state.ok ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <form action={formAction} className="flex flex-wrap gap-2">
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="proposalId" value={proposalId} />
        <input type="hidden" name="decision" value={approveValue} />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          {approveLabel}
        </button>
      </form>
      <form action={formAction} className="flex flex-wrap gap-2">
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="proposalId" value={proposalId} />
        <input type="hidden" name="decision" value={rejectValue} />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-semibold"
        >
          {rejectLabel}
        </button>
      </form>
    </div>
  );
}

function SubmitPayForm({
  householdId,
  proposalId,
}: {
  householdId: string;
  proposalId: string;
}) {
  const [state, action, pending] = useActionState(submitRoutedPaymentAction, null);
  const [idempotencyKey] = useState(() => makeIdempotencyKey());
  return (
    <form action={action} className="space-y-3 rounded-md border border-border p-3">
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="proposalId" value={proposalId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <p className="text-sm text-text-muted">
        Pay the recipient outside HouseholdOS, then record the method here. Money never
        moves through this app.
      </p>
      <label className="block text-sm">
        External method
        <select
          name="externalMethod"
          required
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
          defaultValue="venmo"
        >
          <option value="venmo">Venmo</option>
          <option value="cash_app">Cash App</option>
          <option value="zelle">Zelle</option>
          <option value="cash">Cash</option>
          <option value="check">Check</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="acknowledgeExternal" value="true" required className="mt-1" />
        I already sent this money outside HouseholdOS.
      </label>
      {state && !state.ok ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
        data-testid="submit-routed-payment"
      >
        Record external payment
      </button>
    </form>
  );
}

function SimpleAction({
  householdId,
  proposalId,
  action,
  label,
  testId,
  danger,
}: {
  householdId: string;
  proposalId: string;
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  label: string;
  testId: string;
  danger?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="proposalId" value={proposalId} />
      {state && !state.ok ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        data-testid={testId}
        className={
          danger
            ? "inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-semibold"
            : "inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
        }
      >
        {label}
      </button>
    </form>
  );
}
