import Link from "next/link";
import type { ChoreOccurrenceView } from "@/lib/chores/queries";
import { choreDueLabel } from "@/lib/chores/display";
import { ChoreStatusBadge } from "./ChoreStatusBadge";
import { ChoreQuickComplete } from "./ChoreQuickComplete";

const COMPLETABLE = new Set(["scheduled", "in_progress", "reopened"]);

export function ChoreCard({
  householdId,
  chore,
}: {
  householdId: string;
  chore: ChoreOccurrenceView;
}) {
  const assignees = chore.assignments
    .filter((a) => a.role !== "verifier")
    .map((a) => a.label);
  const due = choreDueLabel({
    dueAt: chore.dueAt,
    dueDate: chore.dueDate,
    allDay: chore.allDay,
  });
  const canComplete = COMPLETABLE.has(chore.status);

  return (
    <li className="border-b border-border last:border-b-0">
      <div className="flex items-start justify-between gap-3 px-4 py-3.5">
        <Link
          href={`/app/${householdId}/chores/${chore.id}`}
          className="min-h-11 min-w-0 flex-1 hover:opacity-90"
        >
          <p className="font-medium text-text-primary">{chore.title}</p>
          <p className="mt-1 text-sm text-text-secondary">{due}</p>
          {assignees.length ? (
            <p className="mt-1 text-xs text-text-muted">
              Assigned to {assignees.join(", ")}
            </p>
          ) : (
            <p className="mt-1 text-xs font-medium text-warning">Unassigned</p>
          )}
        </Link>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {canComplete ? (
            <ChoreQuickComplete householdId={householdId} occurrenceId={chore.id} />
          ) : (
            <ChoreStatusBadge status={chore.status} />
          )}
        </div>
      </div>
    </li>
  );
}
