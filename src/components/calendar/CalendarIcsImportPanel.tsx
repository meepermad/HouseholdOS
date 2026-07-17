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
        Upload an <code>.ics</code> file. Duplicates are skipped by UID.
        Confirming import creates native HouseholdOS events (not Apple
        two-way sync).
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
            Confirm import from the server action in a follow-up deploy step —
            preview verifies parse and UID dedupe first.
          </p>
        </div>
      ) : null}
    </div>
  );
}
