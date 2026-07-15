import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveQuietHoursAction } from "@/app/actions/notifications";
import type { PrivacyPreview } from "@/lib/notifications/templates";
import type { QuietHoursRow } from "@/lib/notifications/queries";

export function NotificationPrivacySelector({
  householdId,
  quietHours,
  privacyPreview,
}: {
  householdId: string;
  quietHours: QuietHoursRow;
  privacyPreview: PrivacyPreview;
}) {
  return (
    <ActionForm
      action={saveQuietHoursAction}
      className="space-y-3"
      pendingLabel="Saving privacy…"
    >
      <input type="hidden" name="householdId" value={householdId} />
      {/* Preserve quiet hours when updating privacy only */}
      <input type="hidden" name="enabled" value={quietHours.enabled ? "true" : "false"} />
      <input type="hidden" name="startLocal" value={quietHours.startLocal} />
      <input type="hidden" name="endLocal" value={quietHours.endLocal} />
      <input type="hidden" name="timeZone" value={quietHours.timeZone} />
      <input
        type="hidden"
        name="allowUrgentOverride"
        value={quietHours.allowUrgentOverride ? "true" : "false"}
      />
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-text-primary">
          Lock-screen preview
        </legend>
        <p className="text-sm text-text-secondary">
          Choose how much detail appears on push banners and lock screens.
        </p>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="radio"
            name="privacyPreview"
            value="generic"
            defaultChecked={privacyPreview === "generic"}
          />
          Generic — category only, no actor names
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="radio"
            name="privacyPreview"
            value="detailed"
            defaultChecked={privacyPreview === "detailed"}
          />
          Detailed — include safe actor context (never amounts or secrets)
        </label>
      </fieldset>
      <SubmitButton pendingLabel="Saving privacy…">Save privacy</SubmitButton>
    </ActionForm>
  );
}
