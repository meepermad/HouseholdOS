import Link from "next/link";
import { AppBackButton } from "@/components/app-back-button";
import { HouseHubTabs } from "@/components/house/HouseHubTabs";
import { PantryForm } from "@/components/house/PantryForm";
import { assertActiveMembership } from "@/lib/household-context";
import { listActiveMemberOptions } from "@/lib/expenses/queries";
import { can } from "@/lib/permissions";
import { listLocations, listPantryItems } from "@/lib/house/queries";
import { PANTRY_STATE_LABELS, OWNERSHIP_LABELS } from "@/lib/house/display";
import { classifyPantryDateState } from "@/lib/house/pantry-dates";

export const dynamic = "force-dynamic";

export default async function PantryPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const ctx = await assertActiveMembership(householdId);
  const create = can(ctx.roles, "resource.create");
  const [items, members, locations] = await Promise.all([
    listPantryItems(householdId),
    create ? listActiveMemberOptions(householdId) : Promise.resolve([]),
    create ? listLocations(householdId) : Promise.resolve([]),
  ]);

  return (
    <main className="space-y-5">
      <AppBackButton fallbackHref={`/app/${householdId}/house`} />
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Pantry</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Communal and personal food. Personal items stay private to their owner.
        </p>
      </header>
      <HouseHubTabs householdId={householdId} />
      {create ? (
        <details className="rounded-md border border-border p-4">
          <summary className="min-h-11 cursor-pointer font-medium">Add pantry item</summary>
          <div className="mt-4">
            <PantryForm householdId={householdId} members={members} locations={locations} />
          </div>
        </details>
      ) : null}
      {items.length === 0 ? (
        <p className="text-sm text-text-secondary">No pantry items visible.</p>
      ) : (
        <ul className="rounded-md border border-border">
          {items.map((item) => {
            const review = classifyPantryDateState({
              useSoon: item.useSoonAt,
              useBy: item.useBy,
            });
            return (
              <li key={item.id} className="border-b border-border last:border-b-0">
                <Link
                  href={`/app/${householdId}/house/pantry/${item.id}`}
                  className="block min-h-11 px-4 py-3.5 hover:bg-surface-interactive"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="mt-1 text-sm text-text-secondary">
                        {OWNERSHIP_LABELS[item.ownershipMode] ?? item.ownershipMode}{" "}
                        ·{" "}
                        {PANTRY_STATE_LABELS[item.state as keyof typeof PANTRY_STATE_LABELS] ??
                          item.state}
                      </p>
                      {review.reviewLabel ? (
                        <p className="mt-1 text-xs text-text-muted">{review.reviewLabel}</p>
                      ) : null}
                    </div>
                    {item.visibility === "owner_only" ? (
                      <span className="text-xs text-text-muted">Private</span>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
