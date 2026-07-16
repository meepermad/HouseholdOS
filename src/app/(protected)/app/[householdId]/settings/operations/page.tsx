import { notFound } from "next/navigation";
import { AppBackButton } from "@/components/app-back-button";
import { WorkerHealthPanel } from "@/components/notifications/WorkerHealthPanel";
import { assertActiveMembership } from "@/lib/household-context";
import { isHouseholdCoordinator } from "@/lib/permissions";
import { getNotificationWorkerHealth } from "@/lib/notifications/worker-health-queries";

export const dynamic = "force-dynamic";

export default async function OperationsSettingsPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const ctx = await assertActiveMembership(householdId);
  if (!isHouseholdCoordinator(ctx.roles)) {
    notFound();
  }

  const health = await getNotificationWorkerHealth(householdId);

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <AppBackButton fallbackHref={`/app/${householdId}/settings/profile`} />
      <header className="space-y-1">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">
          Operations
        </h1>
        <p className="text-sm text-text-secondary">
          Privacy-safe worker, reminder queue, and calendar horizon health.
        </p>
      </header>
      <WorkerHealthPanel health={health} />
    </main>
  );
}
