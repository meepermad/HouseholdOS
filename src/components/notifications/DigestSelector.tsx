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

function resolvePushMode(
  prefs: ChannelPreferenceRow[],
  category: string,
): DeliveryMode {
  const found = prefs.find(
    (p) => p.category === category && p.channel === "push",
  );
  if (found) return found.deliveryMode;
  const defaults =
    CATEGORY_PREFERENCE_DEFAULTS[
      category as keyof typeof CATEGORY_PREFERENCE_DEFAULTS
    ];
  return defaults?.deliveryMode ?? "immediate";
}

const LABELS: Record<(typeof PREFERENCE_CATEGORIES)[number], string> = {
  payments: "Payments",
  disputes: "Disputes",
  membership: "Membership",
  chores: "Chores",
  calendar: "Calendar",
  system: "System",
};

/**
 * Compact per-category push delivery mode (immediate / digest / off).
 */
export function DigestSelector({
  householdId,
  preferences,
}: {
  householdId: string;
  preferences: ChannelPreferenceRow[];
}) {
  return (
    <ActionForm
      action={saveNotificationPreferencesAction}
      className="space-y-3"
      pendingLabel="Saving digest settings…"
    >
      <input type="hidden" name="householdId" value={householdId} />
      <p className="text-sm text-text-secondary">
        Choose whether push alerts for each category arrive immediately or in a
        daily digest.
      </p>
      <ul className="space-y-2">
        {PREFERENCE_CATEGORIES.map((category) => (
          <li
            key={category}
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <span className="text-sm font-medium text-text-primary">
              {LABELS[category]}
            </span>
            <select
              name={`mode_${category}_push`}
              defaultValue={resolvePushMode(preferences, category)}
              className="min-h-11 min-w-[10rem] rounded-md border border-border bg-input-bg px-3 py-2 text-sm"
              aria-label={`${LABELS[category]} push mode`}
            >
              {MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      <SubmitButton pendingLabel="Saving digest settings…">
        Save push timing
      </SubmitButton>
    </ActionForm>
  );
}
