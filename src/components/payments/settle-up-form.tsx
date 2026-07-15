"use client";

import { useMemo, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { submitPaymentAction } from "@/app/actions/payments";
import {
  EXTERNAL_PAYMENT_METHODS,
  suggestOldestFirstAllocation,
  validateAllocations,
  type ObligationForAllocation,
} from "@/lib/payments";
import { formatMoney } from "@/lib/expenses/display";

type Member = { id: string; label: string };

type Props = {
  householdId: string;
  senderMembershipId: string;
  currency: string;
  members: Member[];
  obligations: ObligationForAllocation[];
};

function newIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `pay-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function SettleUpForm({
  householdId,
  senderMembershipId,
  currency,
  members,
  obligations,
}: Props) {
  const recipients = members.filter((m) => m.id !== senderMembershipId);
  const [recipientId, setRecipientId] = useState(recipients[0]?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [amountInput, setAmountInput] = useState("");
  const [allocations, setAllocations] = useState<
    { obligationId: string; amountCents: number }[]
  >([]);
  const [method, setMethod] = useState<(typeof EXTERNAL_PAYMENT_METHODS)[number]>(
    "venmo",
  );
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey] = useState(newIdempotencyKey);

  const owedToRecipient = useMemo(
    () =>
      obligations.filter(
        (o) =>
          o.creditorMembershipId === recipientId &&
          o.officialOutstandingCents > 0,
      ),
    [obligations, recipientId],
  );

  const selectedObligations = owedToRecipient.filter((o) => selected.has(o.id));
  const paymentAmountCents = Math.round(Number.parseFloat(amountInput || "0") * 100);

  const officialSelected = selectedObligations.reduce(
    (s, o) => s + o.officialOutstandingCents,
    0,
  );
  const projectedAfter =
    Number.isFinite(paymentAmountCents) && paymentAmountCents > 0
      ? Math.max(0, officialSelected - paymentAmountCents)
      : officialSelected;

  function toggleObligation(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setAllocations([]);
  }

  function suggest() {
    setError(null);
    try {
      if (!recipientId) throw new Error("Select a recipient.");
      if (selectedObligations.length === 0) {
        throw new Error("Select at least one obligation.");
      }
      if (!Number.isInteger(paymentAmountCents) || paymentAmountCents <= 0) {
        throw new Error("Enter a valid payment amount.");
      }
      const lines = suggestOldestFirstAllocation({
        paymentAmountCents,
        obligations: selectedObligations,
        senderMembershipId,
        recipientMembershipId: recipientId,
        householdId,
        currency,
      });
      setAllocations(lines);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not allocate.");
    }
  }

  function validateBeforeSubmit(): boolean {
    try {
      validateAllocations({
        paymentAmountCents,
        allocations: allocations.map((a) => ({
          obligationId: a.obligationId,
          amountCents: a.amountCents,
        })),
        obligations: selectedObligations,
        senderMembershipId,
        recipientMembershipId: recipientId,
        householdId,
        currency,
      });
      setError(null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid allocations.");
      return false;
    }
  }

  return (
    <div className="space-y-6" data-testid="settle-up-form">
      <section className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="recipient">
          Recipient
        </label>
        <select
          id="recipient"
          className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
          value={recipientId}
          onChange={(e) => {
            setRecipientId(e.target.value);
            setSelected(new Set());
            setAllocations([]);
          }}
          data-testid="recipient-select"
        >
          {recipients.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Obligations owed to recipient
        </h2>
        {owedToRecipient.length === 0 ? (
          <p className="text-sm text-text-secondary">
            No official outstanding obligations to this member.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border bg-surface">
            {owedToRecipient.map((o) => (
              <li key={o.id} className="flex items-center gap-3 px-3 py-3">
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={selected.has(o.id)}
                  onChange={() => toggleObligation(o.id)}
                  aria-label={`Select obligation ${o.id}`}
                  data-testid={`obligation-select-${o.id}`}
                />
                <div className="flex-1 text-sm">
                  <p className="font-medium tabular-nums">
                    {formatMoney(o.officialOutstandingCents)} outstanding
                  </p>
                  <p className="text-xs text-text-muted">
                    Effective {formatMoney(o.effectiveAmountCents)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="amount">
          Payment amount (USD)
        </label>
        <input
          id="amount"
          type="text"
          inputMode="decimal"
          className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
          value={amountInput}
          onChange={(e) => {
            setAmountInput(e.target.value);
            setAllocations([]);
          }}
          placeholder="30.00"
          data-testid="payment-amount"
        />
        <button
          type="button"
          className="min-h-11 rounded-md border border-border px-4 text-sm font-medium hover:bg-surface-interactive"
          onClick={suggest}
          data-testid="suggest-allocation"
        >
          Suggest oldest-first allocation
        </button>
      </section>

      {allocations.length > 0 ? (
        <section className="space-y-2" data-testid="allocation-preview">
          <h2 className="text-sm font-semibold">Allocation preview</h2>
          <ul className="space-y-2 text-sm">
            {allocations.map((a) => (
              <li key={a.obligationId} className="flex justify-between gap-2">
                <span className="text-text-secondary">{a.obligationId.slice(0, 8)}…</span>
                <input
                  type="number"
                  className="min-h-11 w-28 rounded-md border border-border bg-surface px-2 text-right"
                  value={a.amountCents}
                  onChange={(e) => {
                    const cents = Number(e.target.value);
                    setAllocations((prev) =>
                      prev.map((row) =>
                        row.obligationId === a.obligationId
                          ? { ...row, amountCents: cents }
                          : row,
                      ),
                    );
                  }}
                  aria-label={`Allocation cents for ${a.obligationId}`}
                />
              </li>
            ))}
          </ul>
          <p className="text-xs text-text-muted">
            Official for selection: {formatMoney(officialSelected)}. Projected after
            confirmation: {formatMoney(projectedAfter)}.
          </p>
        </section>
      ) : null}

      <ActionForm
        action={async (prev, fd) => {
          if (!validateBeforeSubmit()) {
            return { ok: false, error: error ?? "Review allocations before submitting." };
          }
          return submitPaymentAction(prev, fd);
        }}
        pendingLabel="Submitting payment…"
      >
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="recipientMembershipId" value={recipientId} />
        <input type="hidden" name="totalAmountCents" value={String(paymentAmountCents || 0)} />
        <input
          type="hidden"
          name="allocationsJson"
          value={JSON.stringify(
            allocations.map((a) => ({
              obligationId: a.obligationId,
              amountCents: a.amountCents,
            })),
          )}
        />
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

        <div className="space-y-2">
          <label className="block text-sm font-medium" htmlFor="method">
            External payment method
          </label>
          <select
            id="method"
            name="externalMethod"
            className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
            value={method}
            onChange={(e) =>
              setMethod(e.target.value as (typeof EXTERNAL_PAYMENT_METHODS)[number])
            }
            data-testid="payment-method"
          >
            {EXTERNAL_PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium" htmlFor="claimedPaidAt">
            Claimed payment date (optional)
          </label>
          <input
            id="claimedPaidAt"
            name="claimedPaidAt"
            type="datetime-local"
            className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium" htmlFor="publicNote">
            Public note (optional)
          </label>
          <textarea
            id="publicNote"
            name="publicNote"
            className="min-h-20 w-full rounded-md border border-border bg-surface px-3 py-2"
            maxLength={500}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium" htmlFor="privateNote">
            Private note (sender & recipient only)
          </label>
          <textarea
            id="privateNote"
            name="privateNote"
            className="min-h-20 w-full rounded-md border border-border bg-surface px-3 py-2"
            maxLength={500}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium" htmlFor="externalReference">
            Private external reference (optional)
          </label>
          <input
            id="externalReference"
            name="externalReference"
            className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
            maxLength={120}
          />
        </div>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="acknowledgeExternal"
            value="true"
            className="mt-1 h-5 w-5"
            required
            data-testid="acknowledge-external"
          />
          <span>
            I confirm this payment was sent outside HouseholdOS. HouseholdOS does not
            verify Venmo, Zelle, banks, or other providers.
          </span>
        </label>

        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
          data-testid="submit-payment"
        >
          Submit for recipient confirmation
        </button>
      </ActionForm>
    </div>
  );
}
