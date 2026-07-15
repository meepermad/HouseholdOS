import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { enqueueTestNotificationAction } from "@/app/actions/notifications";

export function TestNotificationButton({
  householdId,
}: {
  householdId: string;
}) {
  return (
    <ActionForm
      action={enqueueTestNotificationAction}
      className="space-y-2"
      pendingLabel="Sending test…"
    >
      <input type="hidden" name="householdId" value={householdId} />
      <p className="text-sm text-text-secondary">
        Sends a fixed test push to your registered devices (rate-limited to once
        per minute).
      </p>
      <SubmitButton pendingLabel="Sending test…">Send test notification</SubmitButton>
    </ActionForm>
  );
}
