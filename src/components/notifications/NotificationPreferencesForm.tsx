import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveNotificationPreferencesAction } from "@/app/actions/notifications";
import {
  PREFERENCE_CATEGORIES,
  type ChannelPreferenceRow,
} from "@/lib/notifications/queries";
import type { DeliveryMode } from "@/lib/notifications/catalog";
import { CATEGORY_PREFERENCE_DEFAULTS } from "@/lib/notifications/catalog";

const MODES: { value: DeliveryMode; label: string }[] = [
  { value: "immediate", label: "Immediate" },
  { value: "daily_digest", label: "Daily digest" },
  { value: "off", label: "Off" },
];

function resolveMode(
  prefs: ChannelPreferenceRow[],
  category: string,
  channel: string,
): DeliveryMode {
  const found = prefs.find(
    (p) => p.category === category && p.channel === channel,
  );
  if (found) return found.deliveryMode;
  if (channel === "email") return "off";
  const defaults =
    CATEGORY_PREFERENCE_DEFAULTS[
      category as keyof typeof CATEGORY_PREFERENCE_DEFAULTS
    ];
  return defaults?.deliveryMode ?? "immediate";
}

const CATEGORY_LABELS: Record<(typeof PREFERENCE_CATEGORIES)[number], string> =
  {
    payments: "Payments",
    disputes: "Disputes",
    membership: "Membership",
    chores: "Chores",
    calendar: "Calendar",
    system: "System",
  };

export function NotificationPreferencesForm({
  householdId,
  preferences,
}: {
  householdId: string;
  preferences: ChannelPreferenceRow[];
}) {
  return (
    <ActionForm
      action={saveNotificationPreferencesAction}
      className="space-y-4"
      pendingLabel="Saving preferences…"
    >
      <input type="hidden" name="householdId" value={householdId} />
      <p className="text-sm text-text-secondary">
        In-app alerts for payments and disputes cannot be turned off.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-text-muted">
              <th className="py-2 pr-3 font-medium">Category</th>
              <th className="py-2 pr-3 font-medium">In-app</th>
              <th className="py-2 pr-3 font-medium">Push</th>
              <th className="py-2 font-medium">Email</th>
            </tr>
          </thead>
          <tbody>
            {PREFERENCE_CATEGORIES.map((category) => (
              <tr key={category} className="border-b border-border">
                <td className="py-3 pr-3 font-medium text-text-primary">
                  {CATEGORY_LABELS[category]}
                </td>
                {(["in_app", "push", "email"] as const).map((channel) => {
                  const name = `mode_${category}_${channel}`;
                  const lockedOff =
                    channel === "in_app" &&
                    (category === "payments" || category === "disputes");
                  return (
                    <td key={channel} className="py-3 pr-3">
                      <select
                        name={name}
                        defaultValue={resolveMode(
                          preferences,
                          category,
                          channel,
                        )}
                        disabled={lockedOff}
                        className="min-h-11 w-full rounded-md border border-border bg-input-bg px-2 py-1.5 disabled:opacity-60"
                        aria-label={`${CATEGORY_LABELS[category]} ${channel}`}
                      >
                        {MODES.filter(
                          (m) => !(lockedOff && m.value === "off"),
                        ).map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SubmitButton pendingLabel="Saving preferences…">
        Save preferences
      </SubmitButton>
    </ActionForm>
  );
}
