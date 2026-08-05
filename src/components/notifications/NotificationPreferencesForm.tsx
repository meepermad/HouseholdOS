import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveNotificationPreferencesAction } from "@/app/actions/notifications";
import type { ChannelPreferenceRow } from "@/lib/notifications/queries";
import {
  CATEGORY_PREFERENCE_DEFAULTS,
  NOTIFICATION_PREFERENCE_GROUPS,
  type PreferenceGroup,
  type SupportedDeliveryMode,
} from "@/lib/notifications/catalog";

const PUSH_MODES: { value: SupportedDeliveryMode; label: string }[] = [
  { value: "immediate", label: "On" },
  { value: "off", label: "Off" },
];

/**
 * A group is On unless every category it covers is explicitly off, so a partial
 * legacy state never reads as "off" while alerts still arrive.
 */
export function resolveGroupPushMode(
  prefs: ChannelPreferenceRow[],
  group: PreferenceGroup,
): SupportedDeliveryMode {
  const modes = group.categories.map((category) => {
    const stored = prefs.find(
      (p) => p.category === category && p.channel === "push",
    );
    if (stored) {
      // Digest was never deliverable; stored digest behaves as immediate.
      return stored.deliveryMode === "off" ? "off" : "immediate";
    }
    const fallback = CATEGORY_PREFERENCE_DEFAULTS[category].deliveryMode;
    return fallback === "off" ? "off" : "immediate";
  });
  return modes.every((m) => m === "off") ? "off" : "immediate";
}

export function NotificationPreferencesForm({
  householdId,
  preferences,
  pushDeliverable = true,
}: {
  householdId: string;
  preferences: ChannelPreferenceRow[];
  /** False when VAPID keys or delivery are not configured on this deployment. */
  pushDeliverable?: boolean;
}) {
  return (
    <ActionForm
      action={saveNotificationPreferencesAction}
      className="space-y-4"
      pendingLabel="Saving preferences…"
    >
      <input type="hidden" name="householdId" value={householdId} />

      <div className="space-y-1 text-sm text-text-secondary">
        <p>
          In-app alerts always arrive in your inbox — that is the household
          record, so it cannot be switched off. Push is the per-category choice.
        </p>
        {pushDeliverable ? null : (
          <p className="text-text-muted" data-testid="prefs-push-unavailable">
            Push is not configured on this deployment yet. Your choices are
            saved and take effect once it is.
          </p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[24rem] border-collapse text-sm">
          <caption className="sr-only">
            Notification delivery by category
          </caption>
          <thead>
            <tr className="border-b border-border text-left text-text-muted">
              <th scope="col" className="py-2 pr-3 font-medium">
                Category
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                In-app
              </th>
              <th scope="col" className="py-2 font-medium">
                Push
              </th>
            </tr>
          </thead>
          <tbody>
            {NOTIFICATION_PREFERENCE_GROUPS.map((group) => (
              <tr key={group.key} className="border-b border-border align-top">
                <th scope="row" className="py-3 pr-3 text-left font-medium">
                  <span className="text-text-primary">{group.label}</span>
                  <span className="mt-0.5 block text-xs font-normal text-text-muted">
                    {group.description}
                  </span>
                </th>
                <td className="py-3 pr-3 text-text-secondary">
                  <span className="inline-flex min-h-11 items-center whitespace-nowrap text-xs">
                    Always on
                  </span>
                </td>
                <td className="py-3">
                  <select
                    name={`push_${group.key}`}
                    defaultValue={resolveGroupPushMode(preferences, group)}
                    className="min-h-11 w-full min-w-[5.5rem] rounded-md border border-border bg-input-bg px-2 py-1.5"
                    aria-label={`${group.label} push alerts`}
                  >
                    {PUSH_MODES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-text-muted">
        Email notifications are not offered because HouseholdOS has no email
        delivery for them.
      </p>

      <SubmitButton pendingLabel="Saving preferences…">
        Save preferences
      </SubmitButton>
    </ActionForm>
  );
}
