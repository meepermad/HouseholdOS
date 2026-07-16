import { CHORE_OCCURRENCE_STATUS_LABELS } from "@/lib/chores/display";
import type { ChoreOccurrenceStatus } from "@/lib/chores/types";

const tones: Partial<Record<ChoreOccurrenceStatus, string>> = {
  completed: "border-success/40 bg-success-soft text-success",
  verified: "border-success/40 bg-success-soft text-success",
  blocked: "border-destructive/40 bg-destructive/10 text-destructive",
  awaiting_verification: "border-warning/40 bg-warning-soft text-warning",
  in_progress: "border-info/40 bg-info-soft text-info",
  cancelled: "border-border-strong bg-surface-secondary text-text-muted",
  skipped: "border-border-strong bg-surface-secondary text-text-muted",
};

export function ChoreStatusBadge({ status }: { status: ChoreOccurrenceStatus }) {
  return (
    <span
      data-status={status}
      className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-medium ${
        tones[status] ?? "border-border bg-surface-secondary text-text-secondary"
      }`}
    >
      <span className="sr-only">Status: </span>
      {CHORE_OCCURRENCE_STATUS_LABELS[status]}
    </span>
  );
}
