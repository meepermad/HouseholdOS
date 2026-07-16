import Link from "next/link";
import type { ResponsibilityAreaView } from "@/lib/chores/queries";
import { EmptyState } from "@/components/ui/empty-state";
import { choreCategoryLabel } from "@/lib/chores/display";

export function ResponsibilityList({ householdId, areas }: { householdId: string; areas: ResponsibilityAreaView[] }) {
  if (!areas.length) return <EmptyState title="No responsibility areas" description="Define ongoing ownership for parts of household life." />;
  return (
    <ul className="divide-y divide-border rounded-md border border-border bg-surface">
      {areas.map((area) => (
        <li key={area.id}>
          <Link className="block min-h-11 px-4 py-3.5 hover:bg-surface-interactive" href={`/app/${householdId}/responsibilities/${area.id}`}>
            <div className="flex justify-between gap-3"><span className="font-medium">{area.name}</span><span className="text-xs text-text-muted">{area.status.replaceAll("_", " ")}</span></div>
            <p className="mt-1 text-sm text-text-secondary">{choreCategoryLabel(area.category)} · {area.assignments.map((a) => a.label).join(", ") || "Unassigned"}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
