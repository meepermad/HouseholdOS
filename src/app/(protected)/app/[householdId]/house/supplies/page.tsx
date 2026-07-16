import { AppBackButton } from "@/components/app-back-button";
import { HouseHubTabs } from "@/components/house/HouseHubTabs";
import { SupplyCard } from "@/components/house/SupplyCard";
import { SupplyForm } from "@/components/house/SupplyForm";
import { assertActiveMembership } from "@/lib/household-context";
import { listActiveMemberOptions } from "@/lib/expenses/queries";
import { can } from "@/lib/permissions";
import { listLocations, listSupplyItems } from "@/lib/house/queries";

export const dynamic = "force-dynamic";

export default async function SuppliesPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const ctx = await assertActiveMembership(householdId);
  const create = can(ctx.roles, "resource.create");
  const [items, members, locations] = await Promise.all([
    listSupplyItems(householdId),
    create ? listActiveMemberOptions(householdId) : Promise.resolve([]),
    create ? listLocations(householdId) : Promise.resolve([]),
  ]);

  return (
    <main className="space-y-5">
      <AppBackButton fallbackHref={`/app/${householdId}/house`} />
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Supplies</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Consumable household stock — exact counts optional.
        </p>
      </header>
      <HouseHubTabs householdId={householdId} />
      {create ? (
        <details className="rounded-md border border-border p-4">
          <summary className="min-h-11 cursor-pointer font-medium">Add supply</summary>
          <div className="mt-4">
            <SupplyForm householdId={householdId} members={members} locations={locations} />
          </div>
        </details>
      ) : null}
      {items.length === 0 ? (
        <p className="text-sm text-text-secondary">No supplies tracked yet.</p>
      ) : (
        <ul className="rounded-md border border-border">
          {items.map((item) => (
            <SupplyCard key={item.id} householdId={householdId} item={item} />
          ))}
        </ul>
      )}
    </main>
  );
}
