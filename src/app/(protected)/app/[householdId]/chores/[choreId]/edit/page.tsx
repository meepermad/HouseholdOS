import { notFound } from "next/navigation";
import { AppBackButton } from "@/components/app-back-button";
import { ActionForm } from "@/components/action-form";
import { pauseChoreDefinitionAction, resumeChoreDefinitionAction, endChoreDefinitionAction } from "@/app/actions/chores";
import { assertActiveMembership } from "@/lib/household-context";
import { getChoreOccurrenceDetail, getChoreDefinitionDetail } from "@/lib/chores/queries";
export const dynamic = "force-dynamic";
export default async function EditChorePage({ params }: { params: Promise<{ householdId: string; choreId: string }> }) {
  const { householdId, choreId } = await params;
  const ctx = await assertActiveMembership(householdId);
  const occurrence = await getChoreOccurrenceDetail(householdId, ctx.membershipId, choreId);
  if (!occurrence) notFound();
  const definition = await getChoreDefinitionDetail(householdId, occurrence.definitionId);
  if (!definition) notFound();
  const hidden = <><input type="hidden" name="householdId" value={householdId} /><input type="hidden" name="definitionId" value={occurrence.definitionId} /></>;
  const cls = "min-h-11 rounded-md border border-border px-4 text-sm font-semibold";
  return <main className="space-y-5"><AppBackButton fallbackHref={`/app/${householdId}/chores/${choreId}`} /><h1 className="font-[family-name:var(--font-display)] text-3xl">Manage {occurrence.title}</h1><p className="text-sm text-text-secondary">Definition status: {String(definition.status)}</p><div className="flex flex-wrap gap-2"><ActionForm action={pauseChoreDefinitionAction}>{hidden}<button className={cls} type="submit">Pause</button></ActionForm><ActionForm action={resumeChoreDefinitionAction}>{hidden}<button className={cls} type="submit">Resume</button></ActionForm><ActionForm action={endChoreDefinitionAction}>{hidden}<button className={`${cls} text-destructive`} type="submit">End recurring chore</button></ActionForm></div></main>;
}
