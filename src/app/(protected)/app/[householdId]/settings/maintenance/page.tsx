export default async function MaintenanceSettingsPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-semibold">Maintenance settings</h1>
      <p className="text-sm text-text-secondary">
        Household {householdId.slice(0, 8)}… Maintenance visibility defaults to
        household for shared-property issues. Personal-property evidence remains
        limited to authorized viewers. Financial coordinator does not receive
        automatic maintenance override.
      </p>
    </div>
  );
}
