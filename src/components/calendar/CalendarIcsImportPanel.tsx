"use client";

import { useState, useTransition } from "react";
import { importIcsPreviewAction } from "@/app/actions/calendar";

export function CalendarIcsImportPanel({
  householdId,
}: {
  householdId: string;
}) {
  const [preview, setPreview] = useState<
    Array<{ uid: string; summary: string; allDay: boolean }>
  >([]);
  const [duplicates, setDuplicates] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-secondary">
        <strong>Preview ICS import</strong> — upload an <code>.ics</code> file to
        parse events and skip duplicate UIDs. Creating native HouseholdOS events
        from this preview is not available yet.
      </p>
      <input
        type="file"
        accept=".ics,text/calendar"
        className="block w-full text-sm"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setError(null);
          startTransition(async () => {
            const text = await file.text();
            const result = await importIcsPreviewAction({
              householdId,
              icsText: text,
            });
            if (!result.ok) {
              setError(result.error);
              setPreview([]);
              return;
            }
            setPreview(result.events);
            setDuplicates(result.duplicateCount);
          });
        }}
      />
      {pending ? <p className="text-sm text-text-secondary">Parsing…</p> : null}
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {preview.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm">
            {preview.length} event(s) ready · {duplicates} duplicate(s) skipped
          </p>
          <ul className="max-h-48 overflow-y-auto rounded-md border border-border text-sm">
            {preview.map((ev) => (
              <li key={ev.uid} className="border-b border-border px-3 py-2 last:border-0">
                {ev.summary}
                {ev.allDay ? " (all-day)" : ""}
              </li>
            ))}
          </ul>
          <p className="text-xs text-text-secondary">
            Confirm is disabled until the create path is implemented. This preview
            only verifies parse and UID dedupe.
          </p>
          <button
            type="button"
            disabled
            className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-semibold opacity-50"
          >
            Confirm import (not available yet)
          </button>
        </div>
      ) : null}
    </div>
  );
}
