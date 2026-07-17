"use client";

import { useMemo, useState, useTransition } from "react";
import {
  confirmReceiptAsExpenseAction,
  updateReceiptReviewAction,
} from "@/app/actions/receipts";
import {
  CLASSIFICATION_OPTIONS,
  classificationLabel,
} from "@/lib/receipts/classification";
import type { LineItemClassification, ResourceDestination } from "@/lib/receipts/types";
import { suggestResourceDestination } from "@/lib/receipts/resource-suggestions";
import { reconcileLineItemsWithTotal } from "@/lib/receipts/totals";

export type ReviewLineItem = {
  id?: string;
  sortIndex: number;
  ocrText: string;
  correctedName: string;
  quantity: number | null;
  unitPriceCents: number | null;
  totalPriceCents: number | null;
  classification: LineItemClassification;
  resourceDestination: ResourceDestination;
  reviewStatus: string;
  participantMembershipIds: string[];
};

type Props = {
  householdId: string;
  receiptId: string;
  merchant: string;
  purchaseDate: string;
  declaredTotalCents: number;
  lineItems: ReviewLineItem[];
  duplicateOutcome?: string | null;
  status: string;
};

export function ReceiptReviewForm({
  householdId,
  receiptId,
  merchant: initialMerchant,
  purchaseDate: initialDate,
  declaredTotalCents: initialTotal,
  lineItems: initialLines,
  duplicateOutcome,
  status,
}: Props) {
  const [merchant, setMerchant] = useState(initialMerchant);
  const [purchaseDate, setPurchaseDate] = useState(initialDate);
  const [declaredTotalCents, setDeclaredTotalCents] = useState(initialTotal);
  const [lines, setLines] = useState(initialLines);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reconciliation = useMemo(
    () =>
      reconcileLineItemsWithTotal({
        lineItems: lines,
        subtotalCents: null,
        taxCents: null,
        tipCents: null,
        totalCents: declaredTotalCents,
      }),
    [lines, declaredTotalCents],
  );

  function updateLine(index: number, patch: Partial<ReviewLineItem>) {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  function saveReview() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("householdId", householdId);
      fd.set("receiptId", receiptId);
      fd.set("merchant", merchant);
      fd.set("purchaseDate", purchaseDate);
      fd.set("declaredTotalCents", String(declaredTotalCents));
      fd.set(
        "lineItemsJson",
        JSON.stringify(
          lines.map((l, i) => ({
            sortIndex: i,
            ocrText: l.ocrText,
            correctedName: l.correctedName,
            quantity: l.quantity,
            unitPriceCents: l.unitPriceCents,
            totalPriceCents: l.totalPriceCents,
            classification: l.classification,
            resourceDestination: l.resourceDestination,
            reviewStatus: "corrected",
            participantMembershipIds: l.participantMembershipIds,
          })),
        ),
      );
      const res = await updateReceiptReviewAction(null, fd);
      setMessage(res.ok ? res.message ?? "Saved." : res.error ?? "Failed.");
    });
  }

  function confirmExpense() {
    startTransition(async () => {
      await saveReview();
      const fd = new FormData();
      fd.set("householdId", householdId);
      fd.set("receiptId", receiptId);
      fd.set("idempotencyKey", crypto.randomUUID());
      await confirmReceiptAsExpenseAction(null, fd);
    });
  }

  return (
    <div className="space-y-6" data-testid="receipt-review">
      {duplicateOutcome && duplicateOutcome !== "none" ? (
        <div
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm"
          data-testid="receipt-duplicate-warning"
          role="status"
        >
          Possible duplicate receipt ({duplicateOutcome}). Review carefully —
          nothing was merged automatically.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Merchant
          <input
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            data-testid="receipt-merchant"
          />
        </label>
        <label className="text-sm">
          Purchase date
          <input
            type="date"
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            data-testid="receipt-purchase-date"
          />
        </label>
        <label className="text-sm">
          Total (cents)
          <input
            type="number"
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2"
            value={declaredTotalCents}
            onChange={(e) => setDeclaredTotalCents(Number(e.target.value) || 0)}
            data-testid="receipt-total-cents"
          />
        </label>
      </div>

      {!reconciliation.balanced ? (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          {reconciliation.warnings.join(" ") || "Totals may need correction."}
        </p>
      ) : null}

      <ul className="space-y-4" data-testid="receipt-line-items">
        {lines.map((line, index) => {
          const suggestion = suggestResourceDestination(line.correctedName);
          return (
            <li
              key={index}
              className="space-y-2 rounded-md border border-border p-3"
            >
              <p className="text-xs text-text-muted">OCR: {line.ocrText || "—"}</p>
              <label className="block text-sm">
                Corrected name
                <input
                  className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2"
                  value={line.correctedName}
                  onChange={(e) =>
                    updateLine(index, { correctedName: e.target.value })
                  }
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-sm">
                  Qty
                  <input
                    type="number"
                    className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2"
                    value={line.quantity ?? ""}
                    onChange={(e) =>
                      updateLine(index, {
                        quantity: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </label>
                <label className="text-sm">
                  Total cents
                  <input
                    type="number"
                    className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2"
                    value={line.totalPriceCents ?? ""}
                    onChange={(e) =>
                      updateLine(index, {
                        totalPriceCents: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                  />
                </label>
              </div>
              <label className="block text-sm">
                Classification
                <select
                  className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2"
                  value={line.classification}
                  onChange={(e) =>
                    updateLine(index, {
                      classification: e.target.value as LineItemClassification,
                    })
                  }
                  data-testid={`receipt-classification-${index}`}
                >
                  {CLASSIFICATION_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {classificationLabel(c)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Resource destination
                <select
                  className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2"
                  value={line.resourceDestination}
                  onChange={(e) =>
                    updateLine(index, {
                      resourceDestination: e.target
                        .value as ResourceDestination,
                    })
                  }
                >
                  <option value="none">Do not update stock yet</option>
                  <option value="pantry_restock">Restock pantry</option>
                  <option value="pantry_add">Add pantry item</option>
                  <option value="supply_restock">Restock supply</option>
                  <option value="supply_add">Add supply</option>
                  <option value="inventory_add">Add durable inventory</option>
                  <option value="shopping_complete">Complete shopping item</option>
                  <option value="do_not_track">Do not track physically</option>
                </select>
              </label>
              {suggestion.destination !== "none" ? (
                <p className="text-xs text-text-muted" data-testid="resource-suggestion">
                  Suggestion: {suggestion.reason}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      {status !== "confirmed" ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={saveReview}
            className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm"
          >
            Save review
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={confirmExpense}
            className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
            data-testid="receipt-confirm-expense"
          >
            Create draft expense
          </button>
        </div>
      ) : (
        <p className="text-sm text-text-secondary">
          This receipt already created a draft expense.
        </p>
      )}

      {message ? (
        <p className="text-sm text-text-secondary" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
