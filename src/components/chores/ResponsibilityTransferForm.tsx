import { ActionForm } from "@/components/action-form";
import { requestResponsibilityTransferAction } from "@/app/actions/responsibilities";
import { Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function ResponsibilityTransferForm({ householdId, areaId, members }: { householdId: string; areaId: string; members: Array<{ id: string; label: string }> }) {
  return (
    <ActionForm action={requestResponsibilityTransferAction} className="space-y-2">
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="areaId" value={areaId} />
      <Select name="toMembershipId" required aria-label="Transfer responsibility to">
        <option value="">Choose recipient</option>{members.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
      </Select>
      <Textarea name="note" rows={2} maxLength={2000} aria-label="Handoff note" placeholder="Handoff note (optional)" />
      <SubmitButton>Request transfer</SubmitButton>
    </ActionForm>
  );
}
