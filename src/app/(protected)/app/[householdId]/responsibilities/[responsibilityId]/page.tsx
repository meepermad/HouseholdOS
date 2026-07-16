import { notFound } from "next/navigation";
import { AppBackButton } from "@/components/app-back-button";
import { Surface } from "@/components/ui/surface";
import { ActionForm } from "@/components/action-form";
import { Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ResponsibilityTransferForm } from "@/components/chores/ResponsibilityTransferForm";
import { acceptResponsibilityTransferAction, assignResponsibilityAreaAction, declineResponsibilityTransferAction } from "@/app/actions/responsibilities";
import { assertActiveMembership } from "@/lib/household-context";
import { getResponsibilityArea, listChoreMembers } from "@/lib/chores/queries";
export const dynamic = "force-dynamic";
const transferActions = [
  ["Accept", acceptResponsibilityTransferAction],
  ["Decline", declineResponsibilityTransferAction],
] as const;
export default async function ResponsibilityPage({ params }: { params: Promise<{ householdId: string; responsibilityId: string }> }) {
  const { householdId, responsibilityId } = await params; await assertActiveMembership(householdId);
  const [area, members] = await Promise.all([getResponsibilityArea(householdId, responsibilityId), listChoreMembers(householdId)]);
  if (!area) notFound();
  return <main className="space-y-5"><AppBackButton fallbackHref={`/app/${householdId}/responsibilities`} /><h1 className="font-[family-name:var(--font-display)] text-3xl">{area.name}</h1><Surface className="space-y-2"><p className="text-sm text-text-secondary">{area.description || "No description."}</p><p className="text-sm">Owners: {area.assignments.map((a) => `${a.label} (${a.role})`).join(", ") || "None"}</p>{area.handoffExpectations ? <p className="text-sm">Handoff: {area.handoffExpectations}</p> : null}</Surface><Surface><h2 className="mb-3 font-semibold">Assign owner</h2><ActionForm action={assignResponsibilityAreaAction} className="flex flex-wrap items-end gap-2"><input type="hidden" name="householdId" value={householdId} /><input type="hidden" name="areaId" value={area.id} /><input type="hidden" name="role" value="owner" /><Select name="membershipId" required aria-label="Owner"><option value="">Choose owner</option>{members.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</Select><SubmitButton>Assign</SubmitButton></ActionForm></Surface><Surface><h2 className="mb-3 font-semibold">Transfer ownership</h2><ResponsibilityTransferForm householdId={householdId} areaId={area.id} members={members} /></Surface>{area.pendingTransfers.map((transfer) => <Surface key={transfer.id} className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm">Transfer awaiting response</p><div className="flex gap-2">{transferActions.map(([label, action]) => <ActionForm key={label} action={action}><input type="hidden" name="householdId" value={householdId} /><input type="hidden" name="transferId" value={transfer.id} /><button className="min-h-11 rounded-md border border-border px-3 text-sm" type="submit">{label}</button></ActionForm>)}</div></Surface>)}</main>;
}
