import { assertActiveMembership } from "@/lib/household-context";
import { SetupWizard } from "@/components/setup/SetupWizard";
import { loadSetupProgress } from "@/lib/setup/queries";
import { AppBackButton } from "@/components/app-back-button";
import {
  getLaunchFeatureReadiness,
  launchFeatureUnavailableMessage,
} from "@/lib/launch/feature-readiness";
import { LaunchFeatureUnavailable } from "@/components/launch/LaunchFeatureUnavailable";

export const dynamic = "force-dynamic";

export default async function SetupPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  await assertActiveMembership(householdId);
  const launch = await getLaunchFeatureReadiness();
  const unavailable = launchFeatureUnavailableMessage("setup", launch);
  if (unavailable) {
    return (
      <main className="app-page-accent space-y-6 pb-8">
        <AppBackButton fallbackHref={`/app/${householdId}/settings`} />
        <LaunchFeatureUnavailable title="Setup not ready" message={unavailable} />
      </main>
    );
  }

  const progress = await loadSetupProgress(householdId);
  if (!progress) {
    return (
      <main className="app-page-accent space-y-6 pb-8">
        <AppBackButton fallbackHref={`/app/${householdId}/settings`} />
        <LaunchFeatureUnavailable
          title="Setup progress unavailable"
          message="Could not load household setup progress. The setup tables or RPCs may be missing or returned an error."
        />
      </main>
    );
  }

  return (
    <main className="app-page-accent space-y-6 pb-8">
      <AppBackButton fallbackHref={`/app/${householdId}/settings`} />
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-text-primary">
          Household setup
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Optional guided launch. Skip any step and finish later — existing
          households are never forced through this flow.
        </p>
      </header>
      <SetupWizard householdId={householdId} initial={progress} />
    </main>
  );
}
