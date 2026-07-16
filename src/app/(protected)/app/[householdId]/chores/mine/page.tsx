import { AppBackButton } from "@/components/app-back-button";
import { MyChoresList } from "@/components/chores/MyChoresList";
import { assertActiveMembership } from "@/lib/household-context";
import { listMyChores } from "@/lib/chores/queries";
export const dynamic = "force-dynamic";
export default async function MyChoresPage({ params }: { params: Promise<{ householdId: string }> }) {
  const { householdId } = await params;
  const ctx = await assertActiveMembership(householdId);
  const chores = await listMyChores(householdId, ctx.membershipId, { status: ["scheduled", "in_progress", "blocked", "awaiting_verification", "reopened"] });
  return <main className="space-y-5"><AppBackButton fallbackHref={`/app/${householdId}/chores`} /><header><h1 className="font-[family-name:var(--font-display)] text-3xl">My chores</h1><p className="mt-1 text-sm text-text-secondary">Work assigned to you.</p></header><MyChoresList householdId={householdId} chores={chores} /></main>;
}
