"use client";

import { useState, useTransition } from "react";
import {
  createImportBatchAction,
  confirmImportBatchAction,
} from "@/app/actions/import";
import {
  IMPORT_DOMAIN_LABELS,
  type ImportDomain,
} from "@/lib/import/domains";

const DOMAINS = Object.keys(IMPORT_DOMAIN_LABELS) as ImportDomain[];

type Props = { householdId: string };

export function ImportCsvPanel({ householdId }: Props) {
  const [domain, setDomain] = useState<ImportDomain>("inventory");
  const [preview, setPreview] = useState<{
    batchId: string;
    validated: Array<{ rowNumber: number; status: string; messages: string[]; mapped: Record<string, string> }>;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4" data-testid="import-csv-panel">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          fd.set("householdId", householdId);
          fd.set("domain", domain);
          fd.set("idempotencyKey", crypto.randomUUID());
          startTransition(async () => {
            const res = await createImportBatchAction(null, fd);
            if (!res.ok) {
              setMessage(res.error ?? "Import failed.");
              return;
            }
            const p = res.preview as {
              validated: Array<{
                rowNumber: number;
                status: string;
                messages: string[];
                mapped: Record<string, string>;
              }>;
            };
            setPreview({
              batchId: res.batchId!,
              validated: p.validated,
            });
            setMessage(res.message ?? "Preview ready.");
          });
        }}
      >
        <label className="block text-sm">
          Domain
          <select
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2"
            value={domain}
            onChange={(e) => setDomain(e.target.value as ImportDomain)}
            data-testid="import-domain"
          >
            {DOMAINS.map((d) => (
              <option key={d} value={d}>
                {IMPORT_DOMAIN_LABELS[d]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          CSV file
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="mt-1 block w-full text-sm"
            data-testid="import-file"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Upload and preview
        </button>
      </form>

      {preview ? (
        <div className="space-y-3" data-testid="import-preview">
          <h2 className="text-sm font-semibold">Preview</h2>
          <ul className="max-h-64 space-y-1 overflow-auto text-xs">
            {preview.validated.slice(0, 50).map((row) => (
              <li key={row.rowNumber} className="rounded border border-border px-2 py-1">
                Row {row.rowNumber}: {row.status}
                {row.messages.length ? ` — ${row.messages.join("; ")}` : ""}
                {" — "}
                {Object.values(row.mapped).filter(Boolean).join(", ")}
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={pending}
            className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
            data-testid="import-confirm"
            onClick={() => {
              startTransition(async () => {
                const fd = new FormData();
                fd.set("householdId", householdId);
                fd.set("batchId", preview.batchId);
                const res = await confirmImportBatchAction(null, fd);
                setMessage(res.ok ? res.message ?? "Done." : res.error ?? "Failed.");
              });
            }}
          >
            Confirm import
          </button>
        </div>
      ) : null}

      {message ? (
        <p className="text-sm text-text-secondary" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
