import Link from "next/link";
import { MaintenanceReportForm } from "@/components/maintenance/MaintenanceReportForm";

export default async function NewMaintenancePage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <header className="space-y-2">
        <Link
          href={`/app/${householdId}/maintenance`}
          className="text-sm text-text-secondary"
        >
          ← Maintenance
        </Link>
        <h1 className="text-2xl font-semibold">Report an issue</h1>
        <p className="text-sm text-text-secondary">
          Safety guidance appears when you select high-risk conditions. The app
          does not contact emergency services.
        </p>
      </header>
      <MaintenanceReportForm householdId={householdId} />
    </div>
  );
}
