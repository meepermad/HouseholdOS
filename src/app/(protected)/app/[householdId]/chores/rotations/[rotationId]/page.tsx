import { notFound } from "next/navigation";
import { AppBackButton } from "@/components/app-back-button";
import { RotationEditor } from "@/components/chores/RotationEditor";
import { ActionForm } from "@/components/action-form";
import { updateRotationStatusAction } from "@/app/actions/chores";
import { assertActiveMembership } from "@/lib/household-context";
import { getRotation, listChoreMembers } from "@/lib/chores/queries";
export const dynamic = "force-dynamic";
export default async function RotationPage({ params }: { params: Promise<{ householdId: string; rotationId: string }> }) {
  const { householdId, rotationId } = await params; await assertActiveMembership(householdId);
  const [rotation, members] = await Promise.all([getRotation(householdId, rotationId), listChoreMembers(householdId)]);
  if (!rotation) notFound();
  const hidden = <><input type="hidden" name="householdId" value={householdId} /><input type="hidden" name="rotationId" value={rotationId} /></>;
  return <main className="mx-auto max-w-2xl space-y-5"><AppBackButton fallbackHref={`/app/${householdId}/chores/rotations`} /><h1 className="font-[family-name:var(--font-display)] text-3xl">{rotation.name}</h1><RotationEditor householdId={householdId} members={members} rotation={rotation} /><div className="flex gap-2"><ActionForm action={updateRotationStatusAction}>{hidden}<input type="hidden" name="paused" value={String(!rotation.paused)} /><button className="min-h-11 rounded-md border border-border px-4 text-sm" type="submit">{rotation.paused ? "Resume" : "Pause"}</button></ActionForm><ActionForm action={updateRotationStatusAction}>{hidden}<input type="hidden" name="ended" value="true" /><button className="min-h-11 rounded-md border border-destructive/40 px-4 text-sm text-destructive" type="submit">End rotation</button></ActionForm></div></main>;
}
