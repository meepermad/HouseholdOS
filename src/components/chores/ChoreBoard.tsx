import Link from "next/link";
import type { ChoreOccurrenceView } from "@/lib/chores/queries";
import { boardSectionForOccurrence, CHORE_BOARD_SECTION_LABELS } from "@/lib/chores/display";
import { EmptyState } from "@/components/ui/empty-state";
import { ChoreCard } from "./ChoreCard";

export function ChoreBoard({
  householdId,
  chores,
  canCreate = false,
}: {
  householdId: string;
  chores: ChoreOccurrenceView[];
  canCreate?: boolean;
}) {
  if (!chores.length) {
    return (
      <EmptyState
        title="No chores scheduled"
        description="Create a one-time or recurring chore to coordinate household work."
        testId="chore-board-empty"
        action={canCreate ? (
          <Link className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground" href={`/app/${householdId}/chores/new`}>
            Create chore
          </Link>
        ) : undefined}
      />
    );
  }
  const groups = new Map<string, ChoreOccurrenceView[]>();
  for (const chore of chores) {
    const section = boardSectionForOccurrence({ status: chore.status, dueAt: chore.dueAt });
    groups.set(section, [...(groups.get(section) ?? []), chore]);
  }
  return (
    <div className="space-y-5" data-testid="chore-board">
      {[...groups.entries()].map(([section, rows]) => (
        <section key={section} className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
            {CHORE_BOARD_SECTION_LABELS[section as keyof typeof CHORE_BOARD_SECTION_LABELS]}
          </h2>
          <ul className="rounded-md border border-border bg-surface">
            {rows.map((chore) => <ChoreCard key={chore.id} householdId={householdId} chore={chore} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}
