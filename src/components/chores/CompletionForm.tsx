import { ActionForm } from "@/components/action-form";
import { completeChoreAction } from "@/app/actions/chores";
import { Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function CompletionForm({ householdId, occurrenceId }: { householdId: string; occurrenceId: string }) {
  return (
    <ActionForm action={completeChoreAction} className="space-y-2" pendingLabel="Completing…">
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="occurrenceId" value={occurrenceId} />
      <Textarea name="note" rows={2} maxLength={2000} aria-label="Completion note" placeholder="Completion note (optional)" />
      <SubmitButton>Mark complete</SubmitButton>
    </ActionForm>
  );
}
