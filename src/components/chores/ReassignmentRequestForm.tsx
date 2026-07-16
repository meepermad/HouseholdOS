import { ActionForm } from "@/components/action-form";
import { requestChoreReassignmentAction } from "@/app/actions/chores";
import { Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function ReassignmentRequestForm({ householdId, occurrenceId, members }: { householdId: string; occurrenceId: string; members: Array<{ id: string; label: string }> }) {
  return (
    <ActionForm action={requestChoreReassignmentAction} className="space-y-2">
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="occurrenceId" value={occurrenceId} />
      <Select name="suggestedMembershipId" aria-label="Suggested assignee">
        <option value="">No suggested assignee</option>
        {members.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
      </Select>
      <Textarea name="reason" required rows={2} maxLength={2000} aria-label="Reassignment reason" placeholder="Why does this need reassignment?" />
      <SubmitButton variant="secondary">Request reassignment</SubmitButton>
    </ActionForm>
  );
}
