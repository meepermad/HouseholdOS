import { assertActiveMembership } from "@/lib/household-context";
import { AppBackButton } from "@/components/app-back-button";
import { ImportCsvPanel } from "@/components/import/ImportCsvPanel";
import {
  getLaunchFeatureReadiness,
  launchFeatureUnavailableMessage,
} from "@/lib/launch/feature-readiness";
import { LaunchFeatureUnavailable } from "@/components/launch/LaunchFeatureUnavailable";

export const dynamic = "force-dynamic";

export default async function ImportSettingsPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  await assertActiveMembership(householdId);
  const launch = await getLaunchFeatureReadiness();
  const unavailable = launchFeatureUnavailableMessage("importExport", launch);
  if (unavailable) {
    return (
      <main className="space-y-6">
        <AppBackButton fallbackHref={`/app/${householdId}/settings`} />
        <LaunchFeatureUnavailable title="Import not ready" message={unavailable} />
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <AppBackButton fallbackHref={`/app/${householdId}/settings`} />
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-text-primary">
          Import data
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Review-first CSV import. Rows are validated and previewed before any
          domain records are created. Opening balances are not supported yet.
        </p>
      </header>
      <ImportCsvPanel householdId={householdId} />
    </main>
  );
}
