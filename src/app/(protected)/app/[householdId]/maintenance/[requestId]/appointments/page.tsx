import Link from "next/link";

export default async function MaintenanceAppointmentsPage({
  params,
}: {
  params: Promise<{ householdId: string; requestId: string }>;
}) {
  const { householdId, requestId } = await params;
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <Link
        href={`/app/${householdId}/maintenance/${requestId}`}
        className="text-sm text-text-secondary"
      >
        ← Request
      </Link>
      <h1 className="text-2xl font-semibold">Appointments</h1>
      <p className="text-sm text-text-secondary">
        Schedule appointments from the request detail page. They appear on the
        household calendar with category maintenance.
      </p>
    </div>
  );
}
