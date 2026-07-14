import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import {
  createHouseholdAction,
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

export default async function OnboardingPage() {
  const { user } = await requireUser();
  if (!user) redirect("/login?next=/onboarding");

  const authorized = await listAuthorizedHouseholdIds(user.id);
  if (authorized.length > 0) {
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
      ? await supabase.from("households").select("id, name").in("id", authorized)
      : { data: [] as { id: string; name: string }[] };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <ShellHeader title="Onboarding" />
      <main className="flex-1 space-y-8 px-4 py-6">
        <section>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">
            Set up your household
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Create the first household, join with an invite link, or resume where you left
            off. Expenses and chores come later.
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
                  <ActionForm action={switchHouseholdAction}>
                    <input type="hidden" name="householdId" value={h.id} />
                    <button type="submit" className="w-full rounded-md border border-line bg-surface px-3 py-3 text-left">
                      {h.name}
                    </button>
                  </ActionForm>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Create household</h2>
          <ActionForm action={createHouseholdAction} className="space-y-3">
            <label className="block text-sm">
              Household name
              <input
                name="name"
                required
                defaultValue={draft.name ?? ""}
                className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              Property nickname (optional)
              <input
                name="propertyNickname"
                defaultValue={draft.propertyNickname ?? ""}
                className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                Lease start
                <input
                  name="leaseStart"
                  type="date"
                  className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                Lease end
                <input
                  name="leaseEnd"
                  type="date"
                  className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
                />
              </label>
            </div>
            <label className="block text-sm">
              Timezone
              <input
                name="timezone"
                required
                defaultValue={draft.timezone || env.DEFAULT_TIMEZONE}
                className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              Currency
              <input
                name="currency"
                required
                defaultValue={draft.currency || env.DEFAULT_CURRENCY}
                pattern="[A-Z]{3}"
                className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              Purchase approval threshold (cents)
              <input
                name="purchaseApprovalThresholdCents"
                type="number"
                min={0}
                defaultValue={5000}
                className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
              />
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                name="acknowledgeReimbursementPolicy"
                type="checkbox"
                value="on"
                required
                className="mt-1"
              />
              <span>
                I acknowledge: one roommate pays shared purchases; HouseholdOS records
                reimbursement obligations and confirmations; payment happens outside the
                app; there is no joint household account.
              </span>
            </label>
            <button
              type="submit"
              className="w-full rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white"
            >
              Create household
            </button>
          </ActionForm>
          <ActionForm action={saveOnboardingDraftAction} className="space-y-2">
            <input type="hidden" name="name" value={draft.name ?? ""} />
            <input
              type="hidden"
              name="propertyNickname"
              value={draft.propertyNickname ?? ""}
            />
            <input type="hidden" name="timezone" value={draft.timezone ?? env.DEFAULT_TIMEZONE} />
            <input type="hidden" name="currency" value={draft.currency ?? env.DEFAULT_CURRENCY} />
            <button type="submit" className="text-sm underline">
              Save draft progress
            </button>
          </ActionForm>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Have an invite?</h2>
          <p className="mt-1 text-sm text-slate-600">
            Open the invite link from your group chat, or paste it after sign-in.
          </p>
          <Link href="/join/paste" className="mt-2 inline-block text-sm underline">
            Enter invite token
          </Link>
        </section>
      </main>
    </div>
  );
}
