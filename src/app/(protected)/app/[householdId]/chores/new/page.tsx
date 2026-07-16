import { AppBackButton } from "@/components/app-back-button";
import { ChoreForm } from "@/components/chores/ChoreForm";
import { assertActiveMembership } from "@/lib/household-context";
import { listChoreMembers, listResponsibilityAreas, listRotations } from "@/lib/chores/queries";
export const dynamic = "force-dynamic";
export default async function NewChorePage({ params }: { params: Promise<{ householdId: string }> }) {
  const { householdId } = await params;
  await assertActiveMembership(householdId);
  const [members, rotations, responsibilities] = await Promise.all([listChoreMembers(householdId), listRotations(householdId), listResponsibilityAreas(householdId)]);
  return <main className="mx-auto max-w-2xl space-y-5"><AppBackButton fallbackHref={`/app/${householdId}/chores`} /><h1 className="font-[family-name:var(--font-display)] text-3xl">New chore</h1><ChoreForm householdId={householdId} members={members} rotations={rotations} responsibilities={responsibilities} /></main>;
}
