import { ActionForm } from "@/components/action-form";
import { blockChoreAction } from "@/app/actions/chores";
import { Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { CHORE_BLOCKED_REASON_LABELS } from "@/lib/chores/display";

export function BlockedForm({ householdId, occurrenceId }: { householdId: string; occurrenceId: string }) {
  return (
    <ActionForm action={blockChoreAction} className="space-y-2">
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="occurrenceId" value={occurrenceId} />
      <Select name="reason" aria-label="Blocked reason">
        {Object.entries(CHORE_BLOCKED_REASON_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </Select>
      <Textarea name="note" rows={2} aria-label="Blocked details" placeholder="What is needed to unblock this?" />
      <SubmitButton variant="secondary">Mark blocked</SubmitButton>
    </ActionForm>
  );
}
