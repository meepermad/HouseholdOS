import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveQuietHoursAction } from "@/app/actions/notifications";
import type { QuietHoursRow } from "@/lib/notifications/queries";

export function QuietHoursEditor({
  householdId,
  quietHours,
}: {
  householdId: string;
  quietHours: QuietHoursRow;
}) {
  return (
    <ActionForm
      action={saveQuietHoursAction}
      className="space-y-3"
      pendingLabel="Saving quiet hours…"
    >
      <input type="hidden" name="householdId" value={householdId} />
      <label className="flex min-h-11 items-center gap-2 text-sm text-text-primary">
        <input
          type="checkbox"
          name="enabled"
          value="true"
          defaultChecked={quietHours.enabled}
          className="h-4 w-4 rounded border-border"
        />
        Enable quiet hours
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-text-primary">
          Start (local)
          <input
            type="time"
            name="startLocal"
            required
            defaultValue={quietHours.startLocal}
            className="mt-1 min-h-11 w-full rounded-md border border-border bg-input-bg px-3 py-2"
          />
        </label>
        <label className="block text-sm text-text-primary">
          End (local)
          <input
            type="time"
            name="endLocal"
            required
            defaultValue={quietHours.endLocal}
            className="mt-1 min-h-11 w-full rounded-md border border-border bg-input-bg px-3 py-2"
          />
        </label>
      </div>
      <label className="block text-sm text-text-primary">
        Time zone
        <input
          name="timeZone"
          required
          defaultValue={quietHours.timeZone}
          className="mt-1 min-h-11 w-full rounded-md border border-border bg-input-bg px-3 py-2"
        />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm text-text-primary">
        <input
          type="checkbox"
          name="allowUrgentOverride"
          value="true"
          defaultChecked={quietHours.allowUrgentOverride}
          className="h-4 w-4 rounded border-border"
        />
        Allow urgent alerts during quiet hours
      </label>
      <SubmitButton pendingLabel="Saving quiet hours…">
        Save quiet hours
      </SubmitButton>
    </ActionForm>
  );
}
