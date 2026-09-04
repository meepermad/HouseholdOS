"use client";

import { ActionForm } from "@/components/action-form";
import { completeChoreAction } from "@/app/actions/chores";

export function ChoreQuickComplete({
  householdId,
  occurrenceId,
}: {
  householdId: string;
  occurrenceId: string;
}) {
  return (
    <ActionForm action={completeChoreAction} pendingLabel="Saving…">
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="occurrenceId" value={occurrenceId} />
      <button
        type="submit"
        className="min-h-11 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground"
        data-testid="chore-quick-complete"
      >
        Done
      </button>
    </ActionForm>
  );
}
