import { ActionForm } from "@/components/action-form";
import { reopenChoreAction, verifyChoreAction } from "@/app/actions/chores";
import { Input } from "@/components/ui/field";

const button = "min-h-11 rounded-md border border-border px-4 text-sm font-semibold";
export function VerificationForm({ householdId, occurrenceId, canVerify }: { householdId: string; occurrenceId: string; canVerify: boolean }) {
  if (!canVerify) return null;
  const hidden = <><input type="hidden" name="householdId" value={householdId} /><input type="hidden" name="occurrenceId" value={occurrenceId} /></>;
  return (
    <div className="flex flex-wrap gap-2">
      <ActionForm action={verifyChoreAction}>{hidden}<button className={button} type="submit">Verify completion</button></ActionForm>
      <ActionForm action={reopenChoreAction} className="flex flex-wrap items-end gap-2">
        {hidden}<Input name="reason" required placeholder="Reason to reopen" aria-label="Reason to reopen" />
        <button className={button} type="submit">Reopen</button>
      </ActionForm>
    </div>
  );
}
