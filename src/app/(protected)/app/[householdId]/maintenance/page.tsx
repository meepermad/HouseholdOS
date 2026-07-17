import Link from "next/link";
import { listMaintenanceRequests } from "@/lib/maintenance/queries";
import type { MaintenanceListItem } from "@/lib/maintenance/queries";
import { isOpenMaintenanceStatus } from "@/lib/maintenance";
import { MaintenanceCard } from "@/components/maintenance/MaintenanceCard";

function MaintenanceSection({
  householdId,
  title,
  rows,
}: {
  householdId: string;
  title: string;
  rows: MaintenanceListItem[];
}) {
  if (rows.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((item) => (
          <MaintenanceCard key={item.id} householdId={householdId} item={item} />
        ))}
      </div>
    </section>
  );
}

export default async function MaintenanceDashboardPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const items = await listMaintenanceRequests(householdId);
  const urgent = items.filter(
    (i) =>
      isOpenMaintenanceStatus(i.status) &&
      (i.severity === "urgent" ||
        i.severity === "emergency_guidance" ||
        i.severity === "high"),
  );
  const open = items.filter((i) => isOpenMaintenanceStatus(i.status));
  const waitingHousehold = items.filter(
    (i) => i.status === "waiting_on_household",
  );
  const waitingLandlord = items.filter(
    (i) => i.status === "waiting_on_landlord",
  );
  const waitingVendor = items.filter((i) => i.status === "waiting_on_vendor");
  const appointments = items.filter(
    (i) => i.status === "appointment_scheduled",
  );
  const resolved = items.filter(
    (i) => i.status === "resolved" || i.status === "closed",
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Maintenance</h1>
          <p className="text-sm text-text-secondary">
            Household issues, repairs, and follow-through
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/app/${householdId}/maintenance/vendors`}
            className="min-h-11 rounded-md border border-border px-4 py-2.5 text-sm"
          >
            Vendors
          </Link>
          <Link
            href={`/app/${householdId}/maintenance/new`}
            className="min-h-11 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Report issue
          </Link>
        </div>
      </header>

      {items.length === 0 ? (
        <p className="text-sm text-text-secondary">No maintenance requests yet.</p>
      ) : (
        <>
          <MaintenanceSection
            householdId={householdId}
            title="Urgent attention"
            rows={urgent}
          />
          <MaintenanceSection
            householdId={householdId}
            title="Open requests"
            rows={open}
          />
          <MaintenanceSection
            householdId={householdId}
            title="Waiting on household"
            rows={waitingHousehold}
          />
          <MaintenanceSection
            householdId={householdId}
            title="Waiting on landlord"
            rows={waitingLandlord}
          />
          <MaintenanceSection
            householdId={householdId}
            title="Waiting on vendor"
            rows={waitingVendor}
          />
          <MaintenanceSection
            householdId={householdId}
            title="Upcoming appointments"
            rows={appointments}
          />
          <MaintenanceSection
            householdId={householdId}
            title="Recently resolved"
            rows={resolved.slice(0, 8)}
          />
        </>
      )}
    </div>
  );
}
