import { previewRotationAssignments } from "@/lib/chores/rotation";
import type { RotationStrategy } from "@/lib/chores/types";

export function RotationPreview({ strategy, members }: { strategy: RotationStrategy; members: Array<{ id: string; label: string }> }) {
  const labels = new Map(members.map((m) => [m.id, m.label]));
  const rows = previewRotationAssignments({
    strategy,
    orderedEligibleMemberIds: members.map((m) => m.id),
    occurrences: Array.from({ length: 6 }, (_, occurrenceIndex) => ({ occurrenceIndex })),
  });
  return (
    <ol className="space-y-1 text-sm">
      {rows.map((row) => <li key={row.occurrenceIndex}>#{row.occurrenceIndex + 1}: {row.membershipId ? labels.get(row.membershipId) : "Unassigned"}</li>)}
    </ol>
  );
}
