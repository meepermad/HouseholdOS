"use client";

import { useActionState, useState } from "react";
import type { ActionResult } from "@/app/actions/auth";
import {
  acceptRoutedRecipientAction,
  approveRoutedIntermediaryAction,
  cancelRoutedSettlementAction,
  confirmRoutedSettlementAction,
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
}: {
  householdId: string;
  proposalId: string;
  status: string;
  role: "payer" | "intermediary" | "recipient" | "other";
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
