"use client";

import { useActionState, useState } from "react";
import { createOpeningBalanceAction } from "@/app/actions/opening-balances";

function makeIdempotencyKey(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Math.random().toString(36).slice(2)}`;
}

export function OpeningBalanceForm({
  householdId,
  members,
  currency,
}: {
  householdId: string;
  members: { id: string; label: string }[];
  currency: string;
}) {
  const [state, action, pending] = useActionState(createOpeningBalanceAction, null);
  const [idempotencyKey] = useState(() => makeIdempotencyKey("ob"));

  return (
    <form action={action} className="max-w-lg space-y-4" data-testid="opening-balance-form">
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="currency" value={currency} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <label className="block text-sm">
        Debtor (owes)
        <select
          name="debtorMembershipId"
          required
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
        >
          <option value="">Select…</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        Creditor (is owed)
        <select
          name="creditorMembershipId"
          required
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
        >
          <option value="">Select…</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        Amount (cents)
        <input
          type="number"
          name="amountCents"
          min={1}
          required
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        Effective date
        <input
          type="date"
          name="effectiveDate"
          required
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        Explanation
        <textarea
          name="explanation"
          required
          rows={3}
          maxLength={2000}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
          placeholder="Balance brought into HouseholdOS from before you started tracking here."
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="submitForConfirmation" />
        Submit for both parties to confirm
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
      >
        {pending ? "Saving…" : "Create opening balance"}
      </button>
    </form>
  );
}
