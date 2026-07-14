import { ActionForm } from "@/components/action-form";
import { updateProfileAction } from "@/app/actions/household";
import { assertActiveMembership, requireUser } from "@/lib/household-context";
import { createClient } from "@/lib/supabase/server";

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
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">Profile</h1>
      <ActionForm action={updateProfileAction} className="space-y-3">
        <input type="hidden" name="householdId" value={householdId} />
        <label className="block text-sm">
          Display name
          <input
            name="displayName"
            required
            defaultValue={profile?.display_name ?? ""}
            className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Preferred timezone
          <input
            name="preferredTimezone"
            required
            defaultValue={profile?.preferred_timezone ?? "America/Chicago"}
            className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Preferred locale
          <input
            name="preferredLocale"
            required
            defaultValue={profile?.preferred_locale ?? "en-US"}
            className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
          />
        </label>
        <p className="text-sm text-slate-500">Email: {profile?.email}</p>
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white"
        >
          Save profile
        </button>
      </ActionForm>
    </main>
  );
}
