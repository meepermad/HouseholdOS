"use client";

import { useState } from "react";
import { formatPastedUsd } from "@/lib/receipts/paste/cents";
import { PASTE_DEV_FIXTURES } from "@/lib/receipts/paste/fixtures";
import { normalizeReceiptPasteInput } from "@/lib/receipts/paste/normalize";
import {
  parseHouseholdOsReceipt,
  type PasteMember,
} from "@/lib/receipts/paste/parse";
import { reconcilePastedReceipt } from "@/lib/receipts/paste/reconcile";

export function PasteParserDebug({
  text,
  members,
  onLoadFixture,
}: {
  text: string;
  members: readonly PasteMember[];
  onLoadFixture: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const normalized = normalizeReceiptPasteInput(text);
  const parsed = parseHouseholdOsReceipt(text, members);
  const rec = parsed.receipt ? reconcilePastedReceipt(parsed.receipt) : null;

  return (
    <div className="rounded-md border border-dashed border-border p-3 text-xs" data-testid="paste-parser-debug">
      <button type="button" className="font-medium text-primary" onClick={() => setOpen((v) => !v)}>
        {open ? "Hide test paste parser" : "Test paste parser"}
      </button>
      {open ? (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {PASTE_DEV_FIXTURES.map((fixture) => (
              <button
                key={fixture.id}
                type="button"
                className="min-h-11 rounded-md border border-border px-3 py-1"
                onClick={() => onLoadFixture(fixture.text)}
                data-testid={`paste-parser-debug-${fixture.id}`}
              >
                Load {fixture.label}
              </button>
            ))}
          </div>
          <p className="font-medium">Normalized text</p>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-surface p-2">
            {normalized.text || "(empty)"}
          </pre>
          <p className="font-medium">Parsed fields</p>
          <ul className="space-y-1">
            <li>ok: {String(parsed.ok)}</li>
            <li>merchant: {parsed.receipt?.merchant ?? "—"}</li>
            <li>date: {parsed.receipt?.purchaseDate ?? "—"}</li>
            <li>total: {parsed.receipt?.totalCents ?? "—"} cents</li>
            <li>subtotal: {parsed.receipt?.subtotalCents ?? "—"} cents</li>
            <li>tax: {parsed.receipt?.taxCents ?? "—"} cents</li>
            <li>items: {parsed.receipt?.items.length ?? 0}</li>
            <li>
              reconciled: {rec ? String(rec.balanced) : "—"}
              {rec ? ` (${formatPastedUsd(rec.unaccountedCents)} unaccounted)` : ""}
            </li>
          </ul>
          {parsed.receipt?.items.length ? (
            <ul className="space-y-1">
              {parsed.receipt.items.map((item, index) => (
                <li key={`${item.description}-${index}`}>
                  {item.description} · line {formatPastedUsd(item.totalCents)} · qty {item.quantity}
                  {item.quantity > 1
                    ? ` · derived unit ${formatPastedUsd(item.derivedUnitPriceCents)}`
                    : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
