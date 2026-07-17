"use client";

import { useActionState, useState } from "react";
import type { ActionResult } from "@/app/actions/auth";
import {
  previewRestoreArchiveAction,
  restoreArchiveIntoHouseholdAction,
} from "@/app/actions/restore";

const DOMAINS = [
  { id: "inventory", label: "Inventory" },
  { id: "supplies", label: "Supplies" },
  { id: "pantry", label: "Pantry" },
  { id: "shopping", label: "Shopping" },
  { id: "chores", label: "Chores" },
  { id: "calendar", label: "Calendar" },
  { id: "utilities", label: "Utilities" },
] as const;

export function RestoreArchivePanel({ householdId }: { householdId: string }) {
  const [archiveJson, setArchiveJson] = useState("");
  const [preview, previewAction, previewPending] = useActionState(
    previewRestoreArchiveAction,
    null as ActionResult | null,
  );
  const [restore, restoreAction, restorePending] = useActionState(
    restoreArchiveIntoHouseholdAction,
    null as ActionResult | null,
  );

  return (
    <section className="space-y-4" data-testid="restore-archive-panel">
      <h2 className="text-lg font-semibold">Restore from export archive</h2>
      <p className="text-sm text-text-muted">
        Selective nonfinancial restore into this household. Expenses, payments,
        obligations, auth, push endpoints, and feed tokens are never imported.
        Prefer creating a fresh household when you need a clean slate.
      </p>

      <label className="block text-sm">
        Archive JSON (export download contents)
        <textarea
          value={archiveJson}
          onChange={(e) => setArchiveJson(e.target.value)}
          rows={8}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
          placeholder='Paste {"archive":{...},"csv":{...}} or the archive object'
        />
      </label>

      <form action={previewAction} className="flex flex-wrap gap-2">
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="archiveJson" value={archiveJson} />
        <button
          type="submit"
          disabled={previewPending || !archiveJson.trim()}
          className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-semibold"
        >
          {previewPending ? "Previewing…" : "Preview restore"}
        </button>
      </form>
      {preview?.ok ? (
        <p className="text-sm text-text-secondary" data-testid="restore-preview">
          {preview.message}
        </p>
      ) : null}
      {preview && !preview.ok ? (
        <p className="text-sm text-danger" role="alert">
          {preview.error}
        </p>
      ) : null}

      <form action={restoreAction} className="space-y-3 rounded-md border border-border p-3">
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="archiveJson" value={archiveJson} />
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Domains to restore</legend>
          {DOMAINS.map((d) => (
            <label key={d.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name={`domain_${d.id}`} defaultChecked />
              {d.label}
            </label>
          ))}
        </fieldset>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="confirmSafety" value="true" required className="mt-1" />
          I understand this appends nonfinancial records and does not restore money
          history or credentials.
        </label>
        {restore && !restore.ok ? (
          <p className="text-sm text-danger" role="alert">
            {restore.error}
          </p>
        ) : null}
        {restore?.ok ? (
          <p className="text-sm text-text-secondary">{restore.message}</p>
        ) : null}
        <button
          type="submit"
          disabled={restorePending || !archiveJson.trim()}
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
          data-testid="restore-archive-submit"
        >
          {restorePending ? "Restoring…" : "Restore selected domains"}
        </button>
      </form>
    </section>
  );
}
