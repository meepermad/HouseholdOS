import { AppBackButton } from "@/components/app-back-button";
import { RotationEditor } from "@/components/chores/RotationEditor";
import { assertActiveMembership } from "@/lib/household-context";
import { listChoreMembers } from "@/lib/chores/queries";
export const dynamic = "force-dynamic";
export default async function NewRotationPage({ params }: { params: Promise<{ householdId: string }> }) {
  const { householdId } = await params; await assertActiveMembership(householdId);
  const members = await listChoreMembers(householdId);
  return <main className="mx-auto max-w-2xl space-y-5"><AppBackButton fallbackHref={`/app/${householdId}/chores/rotations`} /><h1 className="font-[family-name:var(--font-display)] text-3xl">New rotation</h1><RotationEditor householdId={householdId} members={members} /></main>;
}
