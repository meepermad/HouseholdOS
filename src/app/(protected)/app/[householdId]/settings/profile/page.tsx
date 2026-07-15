import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { ThemeSelector } from "@/components/theme-selector";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateProfileAction } from "@/app/actions/household";
import { assertActiveMembership, requireUser } from "@/lib/household-context";
import { createClient } from "@/lib/supabase/server";
import { Surface } from "@/components/ui/surface";

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  await assertActiveMembership(householdId);
  const { user } = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();

  return (
    <main className="mx-auto max-w-xl space-y-8">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
        Profile
      </h1>

      <Surface>
        <ThemeSelector id="settings-theme" />
      </Surface>

      <Surface>
        <h2 className="text-sm font-semibold text-text-primary">Notifications</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Push devices, quiet hours, and delivery preferences.
        </p>
        <Link
          href={`/app/${householdId}/settings/notifications`}
          className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-2"
          data-testid="profile-notification-settings-link"
        >
          Open notification settings
        </Link>
      </Surface>

      <ActionForm
        action={updateProfileAction}
        className="space-y-3"
        pendingLabel="Saving profile…"
      >
        <input type="hidden" name="householdId" value={householdId} />
        <label className="block text-sm text-text-primary">
          Display name
          <input
            name="displayName"
            required
            defaultValue={profile?.display_name ?? ""}
            className="mt-1 min-h-11 w-full rounded-md border border-border bg-input-bg px-3 py-2"
          />
        </label>
        <label className="block text-sm text-text-primary">
          Preferred timezone
          <input
            name="preferredTimezone"
            required
            defaultValue={profile?.preferred_timezone ?? "America/Chicago"}
            className="mt-1 min-h-11 w-full rounded-md border border-border bg-input-bg px-3 py-2"
          />
        </label>
        <label className="block text-sm text-text-primary">
          Preferred locale
          <input
            name="preferredLocale"
            required
            defaultValue={profile?.preferred_locale ?? "en-US"}
            className="mt-1 min-h-11 w-full rounded-md border border-border bg-input-bg px-3 py-2"
          />
        </label>
        <p className="text-sm text-text-muted">Email: {profile?.email}</p>
        <SubmitButton pendingLabel="Saving profile…">Save profile</SubmitButton>
      </ActionForm>
    </main>
  );
}
