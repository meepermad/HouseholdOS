import Link from "next/link";
import type { ChoreOccurrenceView } from "@/lib/chores/queries";
import { choreCategoryLabel } from "@/lib/chores/display";
import { ChoreStatusBadge } from "./ChoreStatusBadge";

export function ChoreCard({
  householdId,
  chore,
}: {
  householdId: string;
  chore: ChoreOccurrenceView;
}) {
  return (
    <li className="border-b border-border last:border-b-0">
      <Link
        href={`/app/${householdId}/chores/${chore.id}`}
        className="block min-h-11 px-4 py-3.5 hover:bg-surface-interactive"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-medium text-text-primary">{chore.title}</p>
            <p className="mt-1 text-sm text-text-secondary">
              {choreCategoryLabel(chore.category)} ·{" "}
              {chore.allDay
                ? `Due ${chore.dueDate ?? new Date(chore.dueAt).toLocaleDateString()}`
                : `Due ${new Date(chore.dueAt).toLocaleString()}`}
            </p>
            {chore.assignments.length ? (
              <p className="mt-1 text-xs text-text-muted">
                Assigned to {chore.assignments.filter((a) => a.role !== "verifier").map((a) => a.label).join(", ") || "a verifier"}
              </p>
            ) : (
              <p className="mt-1 text-xs font-medium text-warning">Unassigned</p>
            )}
          </div>
          <ChoreStatusBadge status={chore.status} />
        </div>
      </Link>
    </li>
  );
}
