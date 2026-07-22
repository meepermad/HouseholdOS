import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { CreateHouseholdForm } from "@/components/create-household-form";
import { CreateHouseholdOnboardingAnchor } from "@/components/create-household-onboarding-anchor";
import {
  saveOnboardingDraftAction,
  switchHouseholdAction,
} from "@/app/actions/household";
import { ShellHeader } from "@/components/shell-header";
import {
  listAuthorizedHouseholdIds,
  requireUser,
  resolvePreferredHouseholdId,
} from "@/lib/household-context";
import { getServerEnv } from "@/lib/env/server";
import { createClient } from "@/lib/supabase/server";
import { RecoveryLogoutForm } from "@/components/recovery-actions";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string }>;
}) {
  const { user } = await requireUser();
  if (!user) redirect("/login?next=/onboarding");

  const params = await searchParams;
  const authorized = await listAuthorizedHouseholdIds(user.id);
  // When arriving from a create-household registration invite, stay on onboarding
  // even if the user already has another household (dual-household is valid).
  if (authorized.length === 1 && params.intent !== "create-household") {
    const preferred = await resolvePreferredHouseholdId(user.id);
    if (preferred) redirect(`/app/${preferred}`);
  }

  const env = getServerEnv();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, onboarding_status, onboarding_draft")
    .eq("id", user.id)
    .maybeSingle();

  const draft =
    profile?.onboarding_draft && typeof profile.onboarding_draft === "object"
      ? (profile.onboarding_draft as Record<string, string>)
      : {};

  const { data: households } =
    authorized.length > 0
      ? await supabase
          .from("households")
          .select("id, name")
          .in("id", authorized)
          .eq("status", "active")
      : { data: [] as { id: string; name: string }[] };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <CreateHouseholdOnboardingAnchor intent={params.intent} />
      <ShellHeader title="Onboarding" />
      <main className="flex-1 space-y-8 px-4 py-6">
        <section>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">
            {authorized.length > 0 ? "Choose a household" : "Set up your household"}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {authorized.length > 0
              ? "Select an authorized household, create another, or join with an invite."
              : "Create the first household, join with an invite link, or resume where you left off."}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Status: {profile?.onboarding_status ?? "pending"}
          </p>
        </section>

        {households && households.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Your households
            </h2>
            <ul className="space-y-2">
              {households.map((h) => (
                <li key={h.id}>
                  <ActionForm
                    action={switchHouseholdAction}
                    pendingLabel="Opening household…"
                  >
                    <input type="hidden" name="householdId" value={h.id} />
                    <button
                      type="submit"
                      className="w-full rounded-md border border-line bg-surface px-3 py-3 text-left"
                    >
                      {h.name}
                    </button>
                  </ActionForm>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section id="create-household" className="space-y-4 scroll-mt-24">
          <h2 className="text-lg font-semibold">Create household</h2>
          <CreateHouseholdForm
            defaultName={draft.name ?? ""}
            defaultPropertyNickname={draft.propertyNickname ?? ""}
            defaultTimezone={draft.timezone || env.DEFAULT_TIMEZONE}
            defaultCurrency={draft.currency || env.DEFAULT_CURRENCY}
          />
          <ActionForm action={saveOnboardingDraftAction} className="space-y-2">
            <input type="hidden" name="name" value={draft.name ?? ""} />
            <input
              type="hidden"
              name="propertyNickname"
              value={draft.propertyNickname ?? ""}
            />
            <input
              type="hidden"
              name="timezone"
              value={draft.timezone ?? env.DEFAULT_TIMEZONE}
            />
            <input
              type="hidden"
              name="currency"
              value={draft.currency ?? env.DEFAULT_CURRENCY}
            />
            <button type="submit" className="text-sm underline">
              Save draft progress
            </button>
          </ActionForm>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Have an invite?</h2>
          <p className="mt-1 text-sm text-slate-600">
            Open the invite link from your group chat, or paste a token or URL.
          </p>
          <Link href="/join/paste" className="mt-2 inline-block text-sm underline">
            Enter invite token or link
          </Link>
        </section>

        <section className="space-y-2 border-t border-line pt-6">
          <Link href="/recovery" className="block text-sm underline">
            Recovery
          </Link>
          <RecoveryLogoutForm label="Sign out" />
        </section>
      </main>
    </div>
  );
}
