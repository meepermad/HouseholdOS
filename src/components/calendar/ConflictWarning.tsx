"use client";

import type { DetectedConflict } from "@/lib/calendar/conflicts";

export function ConflictWarning({
  conflicts,
  onProceed,
  onCancel,
}: {
  conflicts: DetectedConflict[];
  onProceed?: () => void;
  onCancel?: () => void;
}) {
  if (conflicts.length === 0) return null;
  const hard = conflicts.some((c) => c.conflictClass === "hard");

  return (
    <div
      role="alertdialog"
      aria-labelledby="conflict-warning-title"
      className="space-y-3 rounded-md border border-amber-600/40 bg-amber-50 px-4 py-3 dark:bg-amber-950/30"
    >
      <h2 id="conflict-warning-title" className="text-sm font-semibold">
        {hard ? "Hard scheduling conflict" : "Scheduling overlaps detected"}
      </h2>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {conflicts.map((c, i) => (
          <li key={`${c.conflictKind}-${c.conflictingEventId ?? i}`}>
            <span className="sr-only">{c.conflictClass} conflict: </span>
            {c.summary}
            <span className="text-text-secondary">
              {" "}
              ({c.conflictClass.replace("_", " ")})
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm"
          >
            Go back
          </button>
        ) : null}
        {!hard && onProceed ? (
          <button
            type="button"
            onClick={onProceed}
            className="inline-flex min-h-11 items-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground"
          >
            Proceed anyway
          </button>
        ) : null}
      </div>
    </div>
  );
}
