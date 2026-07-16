import Link from "next/link";
import { AppBackButton } from "@/components/app-back-button";
import { EmptyState } from "@/components/ui/empty-state";
import { assertActiveMembership } from "@/lib/household-context";
import { listRotations } from "@/lib/chores/queries";
export const dynamic = "force-dynamic";
export default async function RotationsPage({ params }: { params: Promise<{ householdId: string }> }) {
  const { householdId } = await params; await assertActiveMembership(householdId);
  const rotations = await listRotations(householdId);
  return <main className="space-y-5"><AppBackButton fallbackHref={`/app/${householdId}/chores`} /><header className="flex items-end justify-between gap-3"><h1 className="font-[family-name:var(--font-display)] text-3xl">Chore rotations</h1><Link className="min-h-11 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground" href={`/app/${householdId}/chores/rotations/new`}>New rotation</Link></header>{rotations.length ? <ul className="divide-y divide-border rounded-md border border-border bg-surface">{rotations.map((r) => <li key={r.id}><Link className="block min-h-11 px-4 py-3.5" href={`/app/${householdId}/chores/rotations/${r.id}`}><span className="font-medium">{r.name}</span><span className="ml-2 text-sm text-text-muted">{r.strategy.replaceAll("_", " ")} · {r.members.length} members</span></Link></li>)}</ul> : <EmptyState title="No rotations" description="Rotations distribute recurring chores across household members." />}</main>;
}
