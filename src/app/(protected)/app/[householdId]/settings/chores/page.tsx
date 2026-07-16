import Link from "next/link";
import { AppBackButton } from "@/components/app-back-button";
import { assertActiveMembership } from "@/lib/household-context";
export const dynamic = "force-dynamic";
export default async function ChoreSettingsPage({ params }: { params: Promise<{ householdId: string }> }) {
  const { householdId } = await params; await assertActiveMembership(householdId);
  return <main className="space-y-5"><AppBackButton fallbackHref={`/app/${householdId}/settings/profile`} /><h1 className="font-[family-name:var(--font-display)] text-3xl">Chore settings</h1><p className="text-sm text-text-secondary">Manage household-wide assignment structures.</p><nav className="grid gap-3 sm:grid-cols-2"><Link className="min-h-11 rounded-md border border-border bg-surface p-4 font-medium" href={`/app/${householdId}/chores/rotations`}>Chore rotations</Link><Link className="min-h-11 rounded-md border border-border bg-surface p-4 font-medium" href={`/app/${householdId}/responsibilities`}>Responsibility areas</Link></nav></main>;
}
