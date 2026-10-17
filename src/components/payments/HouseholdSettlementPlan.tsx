"use client";

import { useActionState, useId, useState } from "react";
import {
  cancelHouseholdNetPaymentAction,
  clearHouseholdNetOffsetsAction,
  confirmHouseholdNetPaymentAction,
  recordHouseholdNetPaymentAction,
} from "@/app/actions/household-settlement";
import type { ActionResult } from "@/app/actions/auth";
import { formatMoney } from "@/lib/expenses/display";
import type {
  HouseholdOffset,
  HouseholdPayment,
  HouseholdSettlementPlan,
} from "@/lib/payments/household-plan";
import type { OpenHouseholdPayment } from "@/lib/payments/household-plan-queries";
import { paymentMethodLabel } from "@/lib/presentation/human-status";
import { EXTERNAL_PAYMENT_METHODS } from "@/lib/payments/types";

function makeIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `net-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

function nameOf(labels: Record<string, string>, membershipId: string): string {
  return labels[membershipId] ?? "Someone";
}

function offsetCopy(offset: HouseholdOffset, labels: Record<string, string>): string {
  const names = [
    ...new Set(offset.membershipIds.map((id) => nameOf(labels, id))),
  ];
  const amount = formatMoney(offset.amountCents);
  if (names.length === 2) {
    return `${names[0]} and ${names[1]} already cover ${amount} each way.`;
  }
  return `${names.join(", ")} already cover ${amount} around the household.`;
}

export function HouseholdSettlementPlan({
  householdId,
  plan,
  openPayments,
  memberLabels,
  currentMembershipId,
  recordingReady,
}: {
  householdId: string;
  plan: HouseholdSettlementPlan;
  openPayments: OpenHouseholdPayment[];
  memberLabels: Record<string, string>;
  currentMembershipId: string;
  recordingReady: boolean;
}) {
  const hasPlan = plan.payments.length > 0 || plan.offsets.length > 0;
  if (!hasPlan && openPayments.length === 0) return null;

  return (
    <section className="space-y-4" data-testid="household-plan">
      <div>
        <h2 className="text-lg font-semibold">Clear the household</h2>
        <p className="mt-1 max-w-2xl text-sm text-text-muted">
          One number per person: what they are owed, minus what they owe. Anyone
          at $0 is finished. Pay each other directly, then record it here. A
          confirmed payment reduces the expenses that add up to that amount.
        </p>
      </div>

      {recordingReady ? null : (
        <p className="text-sm text-text-muted" data-testid="household-plan-preview">
          This list is ready to follow. Recording it here needs the latest database update.
        </p>
      )}

      {openPayments.length > 0 ? (
        <ul className="space-y-3">
          {openPayments.map((payment) => (
            <li
              key={payment.id}
              className="rounded-md border border-border bg-surface p-4"
              data-testid="household-open-payment"
            >
              <p className="text-sm font-medium">
                {nameOf(memberLabels, payment.payerMembershipId)} paid{" "}
                {nameOf(memberLabels, payment.recipientMembershipId)}{" "}
                {formatMoney(payment.amountCents)}. Waiting for confirmation.
              </p>
              {currentMembershipId === payment.recipientMembershipId ? (
                <ConfirmForm householdId={householdId} netPaymentId={payment.id} />
              ) : null}
              {currentMembershipId === payment.payerMembershipId ? (
                <CancelForm householdId={householdId} netPaymentId={payment.id} />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {plan.offsets.length > 0 ? (
        <div className="rounded-md border border-border bg-surface p-4" data-testid="household-offsets">
          <p className="text-sm font-medium">These amounts already cancel.</p>
          <ul className="mt-2 space-y-1 text-sm text-text-secondary">
            {plan.offsets.map((offset) => (
              <li key={offset.legs.map((leg) => leg.obligationId).join("-")}>
                {offsetCopy(offset, memberLabels)}
              </li>
            ))}
          </ul>
          {recordingReady ? (
            <ClearOffsetsForm householdId={householdId} />
          ) : null}
        </div>
      ) : null}

      {plan.payments.length > 0 ? (
        <ul className="space-y-4" data-testid="household-payments">
          {plan.payments.map((payment) => (
            <PaymentCard
              key={`${payment.payerMembershipId}-${payment.recipientMembershipId}-${payment.amountCents}-${payment.currency}`}
              householdId={householdId}
              payment={payment}
              memberLabels={memberLabels}
              currentMembershipId={currentMembershipId}
              canRecord={recordingReady && plan.offsets.length === 0}
              offsetPending={recordingReady && plan.offsets.length > 0}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function PaymentCard({
  householdId,
  payment,
  memberLabels,
  currentMembershipId,
  canRecord,
  offsetPending,
}: {
  householdId: string;
  payment: HouseholdPayment;
  memberLabels: Record<string, string>;
  currentMembershipId: string;
  canRecord: boolean;
  offsetPending: boolean;
}) {
  const payer = nameOf(memberLabels, payment.payerMembershipId);
  const recipient = nameOf(memberLabels, payment.recipientMembershipId);
  const isPayer = currentMembershipId === payment.payerMembershipId;
  return (
    <li className="rounded-md border border-border bg-surface p-4" data-testid="household-payment">
      <p className="text-sm font-medium">
        {payer} pays {recipient} {formatMoney(payment.amountCents)}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-secondary">
        {payment.legs.map((leg) => (
          <li key={leg.obligationId}>
            {nameOf(memberLabels, leg.debtorMembershipId)} owes{" "}
            {nameOf(memberLabels, leg.creditorMembershipId)}{" "}
            {formatMoney(leg.amountCents)} less after this is confirmed.
          </li>
        ))}
      </ul>
      {canRecord && isPayer ? (
        <RecordForm householdId={householdId} payment={payment} recipientName={recipient} />
      ) : null}
      {canRecord && !isPayer ? (
        <p className="mt-3 text-sm text-text-muted">Waiting for {payer} to record this payment.</p>
      ) : null}
      {offsetPending ? (
        <p className="mt-3 text-sm text-text-muted">
          Clear the amounts that already cancel, then record this payment.
        </p>
      ) : null}
    </li>
  );
}

function RecordForm({
  householdId,
  payment,
  recipientName,
}: {
  householdId: string;
  payment: HouseholdPayment;
  recipientName: string;
}) {
  const methodId = useId();
  const [idempotencyKey] = useState(() => makeIdempotencyKey());
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    recordHouseholdNetPaymentAction,
    null,
  );
  return (
    <form action={action} className="mt-3 space-y-3">
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="recipientMembershipId" value={payment.recipientMembershipId} />
      <input type="hidden" name="amountCents" value={payment.amountCents} />
      <input type="hidden" name="currency" value={payment.currency} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <p className="text-sm text-text-muted">
        Send {recipientName} {formatMoney(payment.amountCents)} with Venmo, Zelle, cash, or
        another method you already use, then record it here.
      </p>
      <label className="block text-sm" htmlFor={methodId}>
        External method
        <select
          id={methodId}
          name="externalMethod"
          required
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
          defaultValue="venmo"
        >
          {EXTERNAL_PAYMENT_METHODS.map((method) => (
            <option key={method} value={method}>
              {paymentMethodLabel(method)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="acknowledgeExternal" value="true" required className="mt-1" />
        I already sent this money.
      </label>
      {state && !state.ok ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      {state?.ok && state.message ? (
        <p className="text-sm text-text-secondary">{state.message}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        data-testid="record-household-payment"
      >
        {pending ? "Recording…" : `Record payment to ${recipientName}`}
      </button>
    </form>
  );
}

function ClearOffsetsForm({ householdId }: { householdId: string }) {
  const [idempotencyKey] = useState(() => makeIdempotencyKey());
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    clearHouseholdNetOffsetsAction,
    null,
  );
  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      {state && !state.ok ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      {state?.ok && state.message ? (
        <p className="text-sm text-text-secondary">{state.message}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        data-testid="clear-household-offsets"
      >
        {pending ? "Clearing…" : "Clear canceled amounts"}
      </button>
    </form>
  );
}

function ConfirmForm({
  householdId,
  netPaymentId,
}: {
  householdId: string;
  netPaymentId: string;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    confirmHouseholdNetPaymentAction,
    null,
  );
  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="netPaymentId" value={netPaymentId} />
      {state && !state.ok ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        data-testid="confirm-household-payment"
      >
        {pending ? "Confirming…" : "I received this payment"}
      </button>
    </form>
  );
}

function CancelForm({
  householdId,
  netPaymentId,
}: {
  householdId: string;
  netPaymentId: string;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    cancelHouseholdNetPaymentAction,
    null,
  );
  return (
    <form action={action} className="mt-2 space-y-2">
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="netPaymentId" value={netPaymentId} />
      {state && !state.ok ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-medium disabled:opacity-60"
        data-testid="cancel-household-payment"
      >
        {pending ? "Cancelling…" : "Cancel this record"}
      </button>
    </form>
  );
}
