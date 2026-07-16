import Link from "next/link";
import { listChoreActionCenterItems } from "@/lib/chores/queries";

export async function ChoreActionCenter({ householdId, membershipId }: { householdId: string; membershipId: string }) {
  const items = await listChoreActionCenterItems(householdId, membershipId);
  const chores = [
    ...items.overdue.map((c) => ({ ...c, reason: "Overdue" })),
    ...items.awaitingVerification.map((c) => ({ ...c, reason: "Awaiting verification" })),
    ...items.blockedNeedingIntervention.map((c) => ({ ...c, reason: "Blocked" })),
    ...items.reassignmentPending.map((c) => ({ ...c, reason: "Reassignment pending" })),
    ...items.dueSoon.map((c) => ({ ...c, reason: "Due soon" })),
  ].filter((row, index, all) => all.findIndex((other) => other.id === row.id) === index);
  if (!chores.length && !items.responsibilityTransferPending.length) return null;
  return (
    <section className="space-y-3" data-testid="chore-action-center">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Chores needing attention</h2>
      <ul className="divide-y divide-border rounded-md border border-border bg-surface">
        {chores.map((chore) => (
          <li key={chore.id}><Link className="block min-h-11 px-4 py-3.5 text-sm hover:bg-surface-interactive" href={`/app/${householdId}/chores/${chore.id}`}><span className="font-medium">{chore.reason}:</span> {chore.title}</Link></li>
        ))}
        {items.responsibilityTransferPending.map((transfer) => (
          <li key={transfer.id}><Link className="block min-h-11 px-4 py-3.5 text-sm hover:bg-surface-interactive" href={`/app/${householdId}/responsibilities/${transfer.area_id}`}>Responsibility transfer awaiting your response</Link></li>
        ))}
      </ul>
    </section>
  );
}
