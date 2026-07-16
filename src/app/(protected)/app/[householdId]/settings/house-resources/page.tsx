import { createHouseholdLocationFormAction } from "@/app/actions/house";
import { AppBackButton } from "@/components/app-back-button";
import { assertActiveMembership } from "@/lib/household-context";
import { listLocations } from "@/lib/house/queries";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function HouseResourcesSettingsPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const ctx = await assertActiveMembership(householdId);
  const locations = await listLocations(householdId);
  const create = can(ctx.roles, "resource.create");

  return (
    <main className="mx-auto max-w-lg space-y-6">
      <AppBackButton fallbackHref={`/app/${householdId}/settings/profile`} />
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">House resources</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Locations and restock defaults. Automatic shopping for low staples stays off unless you
          confirm (suggest mode).
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-semibold">Locations</h2>
        {locations.length === 0 ? (
          <p className="text-sm text-text-secondary">No locations yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border text-sm">
            {locations.map((loc: { id: string; name: string }) => (
              <li key={loc.id} className="px-4 py-3">
                {loc.name}
              </li>
            ))}
          </ul>
        )}
        {create ? (
          <form action={createHouseholdLocationFormAction} className="flex flex-wrap gap-2">
            <input type="hidden" name="householdId" value={householdId} />
            <input
              className="min-h-11 flex-1 rounded-md border border-border bg-background px-3"
              name="name"
              required
              placeholder="Location name"
              maxLength={200}
            />
            <button
              type="submit"
              className="min-h-11 rounded-md bg-primary px-4 py-2.5 font-semibold text-primary-foreground"
            >
              Add location
            </button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
