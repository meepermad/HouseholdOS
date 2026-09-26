"use client";

import { useMemo, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { submitPaymentAction } from "@/app/actions/payments";
import { recordReceivedPaymentAction } from "@/app/actions/payments";
import {
  EXTERNAL_PAYMENT_METHODS,
  type ExternalPaymentMethod,
} from "@/lib/payments";
import { formatMoney } from "@/lib/expenses/display";
import { paymentMethodLabel } from "@/lib/presentation/human-status";
import { DisclosureSection } from "@/components/ui/disclosure-section";
import {
  allocationsForSelection,
  availableCents,
  filterExpenses,
  formatCentsAsDollars,
  isSelectable,
  pageExpenses,
  parseDollarsToCents,
  selectIds,
  selectionCountLabel,
  summarizeSelection,
  toggleId,
  type SettlementDirection,
  type SettlementExpense,
} from "@/lib/payments/selection";

type Member = { id: string; label: string };

type Props = {
  householdId: string;
  viewerMembershipId: string;
  currency: string;
  members: Member[];
  expenses: SettlementExpense[];
  direction: SettlementDirection;
  initialCounterpartyId?: string;
};

const PAYER_METHODS = EXTERNAL_PAYMENT_METHODS;
const RECIPIENT_METHODS = ["venmo", "zelle", "cash", "bank_transfer", "other"] as const;

function newIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `pay-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayDateInput() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function SettleUpForm({
  householdId,
  viewerMembershipId,
  currency,
  members,
  expenses,
  direction,
  initialCounterpartyId,
}: Props) {
  const counterparties = useMemo(() => {
    const ids = new Set<string>();
    for (const expense of expenses) {
      if (direction === "sent" && expense.debtorMembershipId === viewerMembershipId) {
        ids.add(expense.creditorMembershipId);
      }
      if (
        direction === "received" &&
        expense.creditorMembershipId === viewerMembershipId
      ) {
        ids.add(expense.debtorMembershipId);
      }
    }
    if (initialCounterpartyId) ids.add(initialCounterpartyId);
    return [...ids]
      .filter((id) => id !== viewerMembershipId)
      .map((id) => ({
        id,
        label: members.find((member) => member.id === id)?.label ?? "Roommate",
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [direction, expenses, initialCounterpartyId, members, viewerMembershipId]);

  const defaultCounterpartyId =
    initialCounterpartyId && counterparties.some((row) => row.id === initialCounterpartyId)
      ? initialCounterpartyId
      : (counterparties[0]?.id ?? "");
  const [counterpartyId, setCounterpartyId] = useState(defaultCounterpartyId);
  const [mode, setMode] = useState<"home" | "entire" | "choose">("home");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [amountForKey, setAmountForKey] = useState<{ key: string; value: string } | null>(
    null,
  );
  const [method, setMethod] = useState<ExternalPaymentMethod>("venmo");
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [detailsOpen, setDetailsOpen] = useState<string | null>(null);
  const selectionScope = `${householdId}:${direction}:${viewerMembershipId}:${defaultCounterpartyId}`;
  const [appliedScope, setAppliedScope] = useState(selectionScope);
  if (appliedScope !== selectionScope) {
    setAppliedScope(selectionScope);
    setMode("home");
    setSelected(new Set());
    setQuery("");
    setPage(0);
    setAmountForKey(null);
    setDetailsOpen(null);
    setIdempotencyKey(newIdempotencyKey());
    setCounterpartyId(defaultCounterpartyId);
  }

  const pairExpenses = useMemo(
    () =>
      expenses.filter((expense) =>
        direction === "sent"
          ? expense.debtorMembershipId === viewerMembershipId &&
            expense.creditorMembershipId === counterpartyId
          : expense.creditorMembershipId === viewerMembershipId &&
            expense.debtorMembershipId === counterpartyId,
      ),
    [counterpartyId, direction, expenses, viewerMembershipId],
  );

  const selectable = pairExpenses.filter((expense) => isSelectable(expense, direction));
  const blocked = pairExpenses.filter((expense) => !isSelectable(expense, direction));
  const filtered = filterExpenses(selectable, query);
  const paged = pageExpenses(filtered, page);
  const summary = summarizeSelection(selected, pairExpenses, direction);
  const selectionKey = summary.selected
    .map((expense) => expense.id)
    .sort()
    .join(",");
  const amountInput =
    mode === "entire"
      ? formatCentsAsDollars(summary.totalCents)
      : amountForKey?.key === selectionKey
        ? amountForKey.value
        : summary.totalCents > 0
          ? formatCentsAsDollars(summary.totalCents)
          : "";
  const amountCents = parseDollarsToCents(amountInput) ?? 0;
  const counterparty = counterparties.find((row) => row.id === counterpartyId);
  const counterpartyLabel = counterparty?.label ?? "this roommate";
  const methods = direction === "received" ? RECIPIENT_METHODS : PAYER_METHODS;

  let allocationPreview: { obligationId: string; amountCents: number }[] = [];
  let allocationError: string | null = null;
  if (mode !== "home" && summary.attention.length === 0 && summary.count > 0 && amountCents > 0) {
    try {
      allocationPreview = allocationsForSelection({
        expenses: pairExpenses,
        selectedIds: selected,
        direction,
        amountCents,
        viewerMembershipId,
        counterpartyMembershipId: counterpartyId,
        householdId,
        currency,
      });
    } catch (error) {
      allocationError = error instanceof Error ? error.message : "Could not apply this payment.";
    }
  }

  const displayedIds = paged.rows.map((expense) => expense.id);
  const allDisplayedSelected =
    displayedIds.length > 0 && displayedIds.every((id) => selected.has(id));

  function beginEntire() {
    setMode("entire");
    setSelected(new Set(selectable.map((expense) => expense.id)));
    setAmountForKey(null);
    setPage(0);
    setQuery("");
  }

  function beginChoose() {
    setMode("choose");
    setSelected(new Set());
    setAmountForKey(null);
  }

  const owedCents = selectable.reduce(
    (sum, expense) => sum + availableCents(expense, direction),
    0,
  );

  return (
    <div className="space-y-6" data-testid="settle-up-form">
      {counterparties.length > 1 ? (
        <section className="space-y-2">
          <label className="block text-sm font-medium" htmlFor="counterparty">
            {direction === "sent" ? "Who you paid" : "Who paid you"}
          </label>
          <select
            id="counterparty"
            className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
            value={counterpartyId}
            onChange={(event) => {
              setCounterpartyId(event.target.value);
              setMode("home");
              setSelected(new Set());
              setAmountForKey(null);
              setPage(0);
            }}
            data-testid="recipient-select"
          >
            {counterparties.map((member) => (
              <option key={member.id} value={member.id}>
                {member.label}
              </option>
            ))}
          </select>
        </section>
      ) : null}

      <section className="space-y-3 rounded-md border border-border bg-surface p-4">
        <p className="text-sm text-text-secondary" data-testid="balance-sentence">
          {direction === "sent"
            ? `You owe ${counterpartyLabel}`
            : `${counterpartyLabel} owes you`}
        </p>
        <p className="text-2xl font-semibold tabular-nums" data-testid="pair-balance">
          {formatMoney(owedCents)}
        </p>
        {mode === "home" ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
              onClick={beginEntire}
              disabled={selectable.length === 0}
              data-testid="settle-entire-balance"
            >
              Settle entire balance
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-border px-4 text-sm font-semibold"
              onClick={beginChoose}
              disabled={selectable.length === 0}
              data-testid="choose-expenses"
            >
              Choose expenses
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="text-sm font-medium text-primary underline-offset-2 hover:underline"
            onClick={() => {
              setMode("home");
              setSelected(new Set());
            }}
          >
            Back
          </button>
        )}
        {selectable.length === 0 ? (
          <p className="text-sm text-text-secondary">
            {direction === "sent"
              ? "You do not currently owe this person a confirmed amount."
              : "This person does not currently owe you a confirmed amount."}
          </p>
        ) : null}
      </section>

      {blocked.length > 0 ? (
        <section className="space-y-2" data-testid="ineligible-expenses">
          <h2 className="text-sm font-semibold">Needs attention</h2>
          <ul className="space-y-2 text-sm">
            {blocked.map((expense) => (
              <li key={expense.id} data-testid={`ineligible-${expense.id}`}>
                {expense.label} needs attention.{" "}
                {expense.ineligibleReason ??
                  "It is no longer an open balance you can settle."}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {mode === "choose" ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
              Expenses
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm font-medium"
                onClick={() => setSelected((current) => selectIds(current, displayedIds))}
                data-testid="select-all"
              >
                Select all
              </button>
              <button
                type="button"
                className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm font-medium"
                onClick={() => setSelected(new Set())}
                data-testid="deselect-all"
              >
                Deselect all
              </button>
            </div>
          </div>
          <label className="block text-sm" htmlFor="expense-filter">
            Filter expenses
          </label>
          <input
            id="expense-filter"
            className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            data-testid="expense-filter"
          />
          {filtered.length > paged.rows.length || page > 0 ? (
            <p className="text-xs text-text-muted">
              Select all applies to the expenses on this page. Settle entire balance
              includes every eligible expense with {counterpartyLabel}.
            </p>
          ) : null}
          <ul className="divide-y divide-border rounded-md border border-border bg-surface">
            {paged.rows.map((expense) => (
              <li key={expense.id} className="px-3 py-3">
                <label className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={selected.has(expense.id)}
                    onChange={() => setSelected((current) => toggleId(current, expense.id))}
                    aria-label={`Select ${expense.label}`}
                    data-testid={`obligation-select-${expense.id}`}
                  />
                  <span className="flex-1 text-sm">
                    <span className="block font-medium">{expense.label}</span>
                    <span className="tabular-nums text-text-secondary">
                      {formatMoney(availableCents(expense, direction))} still open
                    </span>
                  </span>
                </label>
                <button
                  type="button"
                  className="mt-1 text-xs font-medium text-primary"
                  onClick={() =>
                    setDetailsOpen((current) => (current === expense.id ? null : expense.id))
                  }
                  data-testid={`expense-details-${expense.id}`}
                >
                  {detailsOpen === expense.id ? "Hide details" : "Details"}
                </button>
                {detailsOpen === expense.id ? (
                  <p className="mt-1 text-xs text-text-muted" data-testid={`expense-detail-panel-${expense.id}`}>
                    {expense.label} · {formatMoney(expense.effectiveAmountCents)} original
                    share · {formatMoney(availableCents(expense, direction))} still open
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          {paged.pageCount > 1 ? (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                className="min-h-11 rounded-md border border-border px-3 text-sm"
                disabled={paged.page === 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
              >
                Previous
              </button>
              <p className="text-xs text-text-muted">
                Page {paged.page + 1} of {paged.pageCount}
              </p>
              <button
                type="button"
                className="min-h-11 rounded-md border border-border px-3 text-sm"
                disabled={paged.page >= paged.pageCount - 1}
                onClick={() => setPage((current) => current + 1)}
                data-testid="selection-page-next"
              >
                Next
              </button>
            </div>
          ) : null}
          {filtered.length === 0 ? (
            <p className="text-sm text-text-secondary">No expenses match that filter.</p>
          ) : null}
        </section>
      ) : null}

      {mode !== "home" ? (
        <ActionForm
          action={
            direction === "received" ? recordReceivedPaymentAction : submitPaymentAction
          }
          pendingLabel={
            direction === "received" ? "Recording payment…" : "Recording what you sent…"
          }
          actionCategory="financial"
          className="space-y-4"
        >
          <input type="hidden" name="householdId" value={householdId} />
          <input
            type="hidden"
            name="recipientMembershipId"
            value={
              direction === "sent" ? counterpartyId : viewerMembershipId
            }
          />
          <input
            type="hidden"
            name="payerMembershipId"
            value={direction === "sent" ? viewerMembershipId : counterpartyId}
          />
          <input type="hidden" name="direction" value={direction} />
          <input type="hidden" name="totalAmountCents" value={String(amountCents || 0)} />
          <input
            type="hidden"
            name="allocationsJson"
            value={JSON.stringify(
              allocationPreview.map((row) => ({
                obligationId: row.obligationId,
                amountCents: row.amountCents,
              })),
            )}
            data-testid="allocations-json"
          />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} data-testid="idempotency-key" />

          <p data-testid="selection-summary" className="text-sm font-medium">
            {selectionCountLabel(summary.count)}
          </p>
          <p className="text-sm tabular-nums" data-testid="selected-total">
            Selected total {formatMoney(summary.totalCents)}
          </p>
          {summary.attention.map((item) => (
            <p key={item.id} className="text-sm text-danger" role="alert" data-testid="selection-attention">
              {item.label} needs attention. {item.reason}
            </p>
          ))}

          {mode === "choose" ? (
            <div className="space-y-2">
              <label className="block text-sm font-medium" htmlFor="amount">
                Amount ({currency})
              </label>
              <input
                id="amount"
                type="text"
                inputMode="decimal"
                className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
                value={amountInput}
                onChange={(event) =>
                  setAmountForKey({ key: selectionKey, value: event.target.value })
                }
                data-testid="payment-amount"
              />
              <p className="text-xs text-text-muted">
                A smaller amount is a partial payment. It applies to the oldest selected
                expenses first.
              </p>
            </div>
          ) : (
            <p className="text-sm text-text-secondary">
              This includes every eligible open expense with {counterpartyLabel}.
            </p>
          )}

          {allocationPreview.length > 0 ? (
            <section className="space-y-2" data-testid="allocation-preview">
              <h2 className="text-sm font-semibold">How this payment will be applied</h2>
              <ul className="space-y-1 text-sm">
                {allocationPreview.map((row) => {
                  const expense = pairExpenses.find((item) => item.id === row.obligationId);
                  return (
                    <li key={row.obligationId} className="flex justify-between gap-2">
                      <span>{expense?.label ?? "Expense"}</span>
                      <span className="tabular-nums">{formatMoney(row.amountCents)}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
          {allocationError ? (
            <p className="text-sm text-danger" role="alert">
              {allocationError}
            </p>
          ) : null}

          <div className="space-y-2">
            <label className="block text-sm font-medium" htmlFor="method">
              Payment method (optional)
            </label>
            <select
              id="method"
              name="externalMethod"
              className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
              value={method}
              onChange={(event) => setMethod(event.target.value as ExternalPaymentMethod)}
              data-testid="payment-method"
            >
              {methods.map((item) => (
                <option key={item} value={item}>
                  {paymentMethodLabel(item)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium" htmlFor="claimedPaidAt">
              Date
            </label>
            <input
              id="claimedPaidAt"
              name="claimedPaidAt"
              type="date"
              defaultValue={todayDateInput()}
              className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
            />
          </div>

          <DisclosureSection title="Note" description="Optional" testId="payment-note">
            <textarea
              name="publicNote"
              className="min-h-20 w-full rounded-md border border-border bg-surface px-3 py-2"
              maxLength={500}
            />
          </DisclosureSection>

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
              {direction === "received"
                ? "I am recording money I received outside HouseholdOS. HouseholdOS does not verify Venmo, Zelle, banks, or cash."
                : "I am recording money I sent outside HouseholdOS. HouseholdOS does not verify Venmo, Zelle, banks, or cash."}
            </span>
          </label>

          <button
            type="submit"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            disabled={
              summary.count === 0 ||
              summary.attention.length > 0 ||
              allocationPreview.length === 0
            }
            data-testid={direction === "received" ? "record-received" : "submit-payment"}
          >
            {direction === "received" ? "Record received payment" : "I sent payment"}
          </button>
          {summary.count === 0 && mode === "choose" ? (
            <p className="text-sm text-danger" role="alert" data-testid="empty-selection">
              Select at least one expense to settle.
            </p>
          ) : null}
        </ActionForm>
      ) : null}

      {allDisplayedSelected ? (
        <span className="sr-only" data-testid="all-displayed-selected">
          All shown expenses are selected
        </span>
      ) : null}
    </div>
  );
}
