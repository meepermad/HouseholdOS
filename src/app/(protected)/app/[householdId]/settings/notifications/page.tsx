import { Surface } from "@/components/ui/surface";
import { PushPermissionCard } from "@/components/notifications/PushPermissionCard";
import { DeviceSubscriptionList } from "@/components/notifications/DeviceSubscriptionList";
import { NotificationPrivacySelector } from "@/components/notifications/NotificationPrivacySelector";
import { NotificationPreferencesForm } from "@/components/notifications/NotificationPreferencesForm";
import { QuietHoursEditor } from "@/components/notifications/QuietHoursEditor";
import { DigestSelector } from "@/components/notifications/DigestSelector";
import { TestNotificationButton } from "@/components/notifications/TestNotificationButton";
import { assertActiveMembership } from "@/lib/household-context";
import { getPublicEnv } from "@/lib/env/public";
import {
  getChannelPreferences,
  getNotificationPrivacyPreview,
  getQuietHours,
  listPushDevices,
  type ChannelPreferenceRow,
  type PushDeviceRow,
  type QuietHoursRow,
} from "@/lib/notifications/queries";
import type { PrivacyPreview } from "@/lib/notifications/templates";
import { logServerError } from "@/lib/errors";
import Link from "next/link";

export const dynamic = "force-dynamic";

const FALLBACK_QUIET: QuietHoursRow = {
  enabled: false,
  startLocal: "22:00",
  endLocal: "07:00",
  timeZone: "America/Chicago",
  allowUrgentOverride: true,
  previewMode: "generic",
};

export default async function NotificationSettingsPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const ctx = await assertActiveMembership(householdId);

  let devices: PushDeviceRow[] = [];
  let quietHours: QuietHoursRow = FALLBACK_QUIET;
  let preferences: ChannelPreferenceRow[] = [];
  let privacyPreview: PrivacyPreview = "generic";

  try {
    const [deviceRows, quiet, prefs, preview] = await Promise.all([
      listPushDevices(ctx.userId),
      getQuietHours(ctx.userId),
      getChannelPreferences(ctx.userId),
      getNotificationPrivacyPreview(ctx.userId),
    ]);
    devices = deviceRows;
    quietHours = quiet;
    preferences = prefs;
    privacyPreview = preview;
  } catch (error) {
    logServerError("notification_settings", error, { householdId });
  }

  const env = getPublicEnv();
  const vapidPublicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  return (
    <main
      className="mx-auto max-w-2xl space-y-8"
      data-testid="notification-settings-page"
    >
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text-primary">
          Notifications
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Push, quiet hours, and delivery preferences for your account.
        </p>
        <Link
          href={`/app/${householdId}/notifications`}
          className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-2"
        >
          Open inbox
        </Link>
      </div>

      <Surface className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Push on this device
        </h2>
        <PushPermissionCard
          householdId={householdId}
          vapidPublicKey={vapidPublicKey}
        />
      </Surface>

      <Surface className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Registered devices
        </h2>
        <DeviceSubscriptionList householdId={householdId} devices={devices} />
      </Surface>

      <Surface className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Lock-screen privacy
        </h2>
        <NotificationPrivacySelector
          householdId={householdId}
          quietHours={quietHours}
          privacyPreview={privacyPreview}
        />
      </Surface>

      <Surface className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Category preferences
        </h2>
        <NotificationPreferencesForm
          householdId={householdId}
          preferences={preferences}
        />
      </Surface>

      <Surface className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Push timing / digest
        </h2>
        <DigestSelector householdId={householdId} preferences={preferences} />
      </Surface>

      <Surface className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Quiet hours
        </h2>
        <QuietHoursEditor householdId={householdId} quietHours={quietHours} />
      </Surface>

      <Surface className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Email
        </h2>
        <p className="text-sm text-text-secondary">
          Email delivery is not configured in this phase. Preferences above are
          saved for when email is enabled.
        </p>
      </Surface>

      <Surface className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Test
        </h2>
        <TestNotificationButton householdId={householdId} />
      </Surface>
    </main>
  );
}
