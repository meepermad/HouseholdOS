import { previewRotationAssignments } from "@/lib/chores/rotation";
import type { RotationStrategy } from "@/lib/chores/types";
import { EmptyState } from "@/components/ui/empty-state";

export function RotationPreview({
  strategy,
  members,
  startDate,
}: {
  strategy: RotationStrategy;
  members: Array<{ id: string; label: string }>;
  /** Optional ISO date for the first occurrence preview. */
  startDate?: string;
}) {
  if (strategy === "round_robin" && members.length < 2) {
    return (
      <EmptyState
        variant="section"
        title="Round robin needs at least two eligible members"
        description="Use a fixed assignment or invite another roommate."
        testId="rotation-single-member-warning"
      />
    );
  }

  const labels = new Map(members.map((m) => [m.id, m.label]));
  const rows = previewRotationAssignments({
    strategy,
    orderedEligibleMemberIds: members.map((m) => m.id),
    occurrences: Array.from({ length: 6 }, (_, occurrenceIndex) => ({
      occurrenceIndex,
    })),
  });

  const base = startDate ? new Date(startDate) : null;

  return (
    <ol className="space-y-1 text-sm" data-testid="rotation-preview">
      {rows.map((row) => {
        let dateLabel = `#${row.occurrenceIndex + 1}`;
        if (base && !Number.isNaN(base.getTime())) {
          const d = new Date(base);
          d.setDate(d.getDate() + row.occurrenceIndex * 7);
          dateLabel = d.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          });
        }
        const name = row.membershipId
          ? labels.get(row.membershipId) ?? "Member"
          : "Unassigned";
        return (
          <li key={row.occurrenceIndex}>
            {dateLabel} — {name}
          </li>
        );
      })}
    </ol>
  );
}
