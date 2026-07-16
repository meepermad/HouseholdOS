import Link from "next/link";
import { notFound } from "next/navigation";
import { AppBackButton } from "@/components/app-back-button";
import { assertActiveMembership } from "@/lib/household-context";
import { getChoreDefinitionDetail, listBoardOccurrences } from "@/lib/chores/queries";
export const dynamic = "force-dynamic";
export default async function DefinitionPage({ params }: { params: Promise<{ householdId: string; definitionId: string }> }) {
  const { householdId, definitionId } = await params;
  const ctx = await assertActiveMembership(householdId);
  const [definition, occurrences] = await Promise.all([getChoreDefinitionDetail(householdId, definitionId), listBoardOccurrences(householdId, ctx.membershipId)]);
  if (!definition) notFound();
  const first = occurrences.find((o) => o.definitionId === definitionId);
  return <main className="space-y-5"><AppBackButton fallbackHref={`/app/${householdId}/chores`} /><h1 className="font-[family-name:var(--font-display)] text-3xl">{String(definition.title)}</h1><p className="text-sm text-text-secondary">Recurring chore · {String(definition.status)}</p>{first ? <Link className="inline-flex min-h-11 items-center underline" href={`/app/${householdId}/chores/${first.id}`}>Open next occurrence</Link> : <p>No occurrence is currently materialized.</p>}</main>;
}
