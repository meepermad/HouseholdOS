import { ActionForm } from "@/components/action-form";
import { assignChoreAction, claimChoreAction, startChoreAction } from "@/app/actions/chores";
import { Select } from "@/components/ui/field";

const submitClass = "min-h-11 rounded-md border border-border px-3 text-sm font-semibold hover:bg-surface-interactive";

export function AssignmentControls({
  householdId,
  occurrenceId,
  members,
  canAssign,
}: {
  householdId: string;
  occurrenceId: string;
  members: Array<{ id: string; label: string }>;
  canAssign: boolean;
}) {
  const hidden = <><input type="hidden" name="householdId" value={householdId} /><input type="hidden" name="occurrenceId" value={occurrenceId} /></>;
  return (
    <div className="flex flex-wrap gap-2">
      <ActionForm action={claimChoreAction}>{hidden}<button className={submitClass} type="submit">Claim</button></ActionForm>
      <ActionForm action={startChoreAction}>{hidden}<button className={submitClass} type="submit">Start</button></ActionForm>
      {canAssign ? (
        <ActionForm action={assignChoreAction} className="flex flex-wrap items-end gap-2">
          {hidden}<input type="hidden" name="role" value="primary" />
          <Select name="membershipId" aria-label="Assign member" required>
            <option value="">Choose member</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </Select>
          <button className={submitClass} type="submit">Assign</button>
        </ActionForm>
      ) : null}
    </div>
  );
}
