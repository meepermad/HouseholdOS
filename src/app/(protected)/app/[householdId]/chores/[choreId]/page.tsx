import Link from "next/link";
import { notFound } from "next/navigation";
import { AppBackButton } from "@/components/app-back-button";
import { Surface } from "@/components/ui/surface";
import { AssignmentControls } from "@/components/chores/AssignmentControls";
import { BlockedForm } from "@/components/chores/BlockedForm";
import { CompletionForm } from "@/components/chores/CompletionForm";
import { ReassignmentRequestForm } from "@/components/chores/ReassignmentRequestForm";
import { VerificationForm } from "@/components/chores/VerificationForm";
import { ChoreStatusBadge } from "@/components/chores/ChoreStatusBadge";
import { ActionForm } from "@/components/action-form";
import { cancelChoreAction, skipChoreAction } from "@/app/actions/chores";
import { assertActiveMembership } from "@/lib/household-context";
import { can } from "@/lib/permissions";
import { getChoreOccurrenceDetail, listChoreMembers } from "@/lib/chores/queries";
export const dynamic = "force-dynamic";
export default async function ChoreDetailPage({ params }: { params: Promise<{ householdId: string; choreId: string }> }) {
  const { householdId, choreId } = await params;
  const ctx = await assertActiveMembership(householdId);
  const [chore, members] = await Promise.all([getChoreOccurrenceDetail(householdId, ctx.membershipId, choreId), listChoreMembers(householdId)]);
  if (!chore) notFound();
  const assigned = chore.assignments.some((a) => a.membershipId === ctx.membershipId && a.role !== "verifier");
  const manage = chore.creatorMembershipId === ctx.membershipId || can(ctx.roles, "chore.coordinator_override");
  const active = ["scheduled", "in_progress", "blocked", "reopened"].includes(chore.status);
  const hidden = <><input type="hidden" name="householdId" value={householdId} /><input type="hidden" name="occurrenceId" value={chore.id} /></>;
  return (
    <main className="space-y-5">
      <AppBackButton fallbackHref={`/app/${householdId}/chores`} />
      <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="font-[family-name:var(--font-display)] text-3xl">{chore.title}</h1><p className="mt-1 text-sm text-text-secondary">Due {new Date(chore.dueAt).toLocaleString()}</p></div><ChoreStatusBadge status={chore.status} /></header>
      <Surface className="space-y-3">
        {chore.description ? <p className="text-sm text-text-secondary">{chore.description}</p> : null}
        <p className="text-sm">Assigned: {chore.assignments.map((a) => `${a.label} (${a.role})`).join(", ") || "Nobody yet"}</p>
        <AssignmentControls householdId={householdId} occurrenceId={chore.id} members={members} canAssign={manage} />
      </Surface>
      {active && assigned ? <div className="grid gap-4 lg:grid-cols-2"><Surface><h2 className="mb-3 font-semibold">Complete</h2><CompletionForm householdId={householdId} occurrenceId={chore.id} /></Surface><Surface><h2 className="mb-3 font-semibold">Blocked</h2><BlockedForm householdId={householdId} occurrenceId={chore.id} /></Surface></div> : null}
      {assigned && active ? <Surface><h2 className="mb-3 font-semibold">Need someone else?</h2><ReassignmentRequestForm householdId={householdId} occurrenceId={chore.id} members={members} /></Surface> : null}
      <VerificationForm householdId={householdId} occurrenceId={chore.id} canVerify={can(ctx.roles, "chore.coordinator_override") || chore.verifierMembershipId === ctx.membershipId} />
      {manage && active ? <div className="flex flex-wrap gap-2"><ActionForm action={skipChoreAction}>{hidden}<input type="hidden" name="reason" value="Skipped by manager" /><button className="min-h-11 rounded-md border border-border px-4 text-sm" type="submit">Skip</button></ActionForm><ActionForm action={cancelChoreAction}>{hidden}<button className="min-h-11 rounded-md border border-destructive/40 px-4 text-sm text-destructive" type="submit">Cancel</button></ActionForm></div> : null}
      {manage ? <Link className="inline-flex min-h-11 items-center text-sm underline" href={`/app/${householdId}/chores/${chore.id}/edit`}>Manage recurring definition</Link> : null}
    </main>
  );
}
