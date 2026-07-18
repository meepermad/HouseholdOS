"use client";

import { useActionState, useId, useState } from "react";
import { proposeRoutedSettlementAction } from "@/app/actions/routed-settlements";
import type { RoutedSettlementSuggestion } from "@/lib/payments/routed-suggestions";
import { formatMoney } from "@/lib/expenses/display";
import type { ActionResult } from "@/app/actions/auth";

function makeIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `route-${Math.random().toString(36).slice(2)}`;
}

export function SimplifySuggestionList({
  householdId,
  suggestions,
  memberLabel,
}: {
  householdId: string;
  suggestions: RoutedSettlementSuggestion[];
  memberLabel: (membershipId: string) => string;
}) {
  if (suggestions.length === 0) {
    return (
      <p className="text-sm text-text-muted" data-testid="simplify-empty">
        No safe three-person routes right now. Pairwise settle-up still works from
        Balances.
      </p>
    );
  }

  return (
    <ul className="space-y-4" data-testid="simplify-suggestions">
      {suggestions.map((s) => {
        const payer = memberLabel(s.payerMembershipId);
        const intermediary = memberLabel(s.intermediaryMembershipId);
        const recipient = memberLabel(s.recipientMembershipId);
        return (
          <li
            key={`${s.obligationAbId}-${s.obligationBcId}-${s.amountCents}`}
            className="rounded-md border border-border bg-surface p-4"
            data-testid="simplify-suggestion-card"
          >
            <p className="text-sm font-medium">
              Suggested routed payment · {formatMoney(s.amountCents)}
            </p>
            <div className="mt-3 space-y-2 text-sm text-text-secondary">
              <p>
                You owe {intermediary} {formatMoney(s.beforeEdges.ab)}.
              </p>
              <p>
                {intermediary} owes {recipient} {formatMoney(s.beforeEdges.bc)}.
              </p>
              <p className="font-medium text-text-primary">
                {payer} could pay {recipient} {formatMoney(s.amountCents)} on{" "}
                {intermediary}&apos;s behalf.
              </p>
            </div>

            <div className="mt-3 rounded-md border border-border bg-background px-3 py-3 text-sm">
              <p className="font-medium">Before balances change:</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-text-secondary">
                <li>{intermediary} must approve.</li>
                <li>
                  {recipient} must agree to receive the payment.
                </li>
                <li>
                  {payer} must pay {recipient} outside HouseholdOS (Venmo, Cash App,
                  Zelle, cash, etc.).
                </li>
                <li>
                  {recipient} must confirm receiving exactly{" "}
                  {formatMoney(s.amountCents)}.
                </li>
              </ol>
            </div>

            <div className="mt-3 text-sm text-text-secondary">
              <p className="font-medium text-text-primary">After confirmation:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  {payer} would owe {intermediary}{" "}
                  {formatMoney(s.afterEdges.ab)}.
                </li>
                <li>
                  {intermediary} would owe {recipient}{" "}
                  {formatMoney(s.afterEdges.bc)}.
                </li>
              </ul>
              <p className="mt-2 text-xs text-text-muted">
                Participants: {payer}, {intermediary}, and {recipient}. If balances
                change before confirmation, the proposal may become stale and should
                be reviewed or cancelled. Reversing a confirmed routed settlement
                restores the prior obligations.
              </p>
            </div>

            <ProposeForm householdId={householdId} suggestion={s} />
          </li>
        );
      })}
    </ul>
  );
}

function ProposeForm({
  householdId,
  suggestion,
}: {
  householdId: string;
  suggestion: RoutedSettlementSuggestion;
}) {
  const formId = useId();
  const [idempotencyKey] = useState(() => makeIdempotencyKey());
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    proposeRoutedSettlementAction,
    null,
  );

  return (
    <form action={action} className="mt-3 space-y-2" id={formId}>
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="payerMembershipId" value={suggestion.payerMembershipId} />
      <input
        type="hidden"
        name="intermediaryMembershipId"
        value={suggestion.intermediaryMembershipId}
      />
      <input
        type="hidden"
        name="recipientMembershipId"
        value={suggestion.recipientMembershipId}
      />
      <input type="hidden" name="obligationAbId" value={suggestion.obligationAbId} />
      <input type="hidden" name="obligationBcId" value={suggestion.obligationBcId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <label className="flex flex-wrap items-center gap-2 text-sm">
        <span>Amount (cents, max {suggestion.amountCents})</span>
        <input
          type="number"
          name="amountCents"
          min={1}
          max={suggestion.amountCents}
          defaultValue={suggestion.amountCents}
          className="w-28 rounded-md border border-border bg-background px-2 py-1"
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
        className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        data-testid="propose-routed-payment"
      >
        {pending ? "Proposing…" : "Propose routed payment"}
      </button>
    </form>
  );
}
