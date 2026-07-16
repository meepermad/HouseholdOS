import Link from "next/link";
import { AppBackButton } from "@/components/app-back-button";
import { HouseHubTabs } from "@/components/house/HouseHubTabs";
import { InventoryCard } from "@/components/house/InventoryCard";
import { assertActiveMembership } from "@/lib/household-context";
import { can } from "@/lib/permissions";
import { INVENTORY_CATEGORIES, type InventoryCategory } from "@/lib/house/categories";
import { listInventoryItems } from "@/lib/house/queries";
import type { InventoryStatus } from "@/lib/house/types";

const INVENTORY_STATUSES: InventoryStatus[] = [
  "active",
  "loaned",
  "missing",
  "damaged",
  "repair_needed",
  "disposed",
  "donated",
  "sold",
  "moved_out",
  "returned",
];

export const dynamic = "force-dynamic";

export default async function InventoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ householdId: string }>;
  searchParams: Promise<{ q?: string; category?: string; status?: string }>;
}) {
  const { householdId } = await params;
  const filters = await searchParams;
  const ctx = await assertActiveMembership(householdId);
  const status = INVENTORY_STATUSES.includes(filters.status as InventoryStatus)
    ? (filters.status as InventoryStatus)
    : undefined;
  const category = INVENTORY_CATEGORIES.includes(filters.category as InventoryCategory)
    ? (filters.category as InventoryCategory)
    : undefined;
  const items = await listInventoryItems(householdId, {
    q: filters.q,
    category,
    status,
  });
  const create = can(ctx.roles, "resource.create");

  return (
    <main className="space-y-5">
      <AppBackButton fallbackHref={`/app/${householdId}/house`} />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">Inventory</h1>
          <p className="mt-1 text-sm text-text-secondary">Durable household items.</p>
        </div>
        {create ? (
          <Link
            className="min-h-11 rounded-md bg-primary px-4 py-2.5 font-semibold text-primary-foreground"
            href={`/app/${householdId}/house/inventory/new`}
          >
            Add item
          </Link>
        ) : null}
      </header>
      <HouseHubTabs householdId={householdId} />
      <form className="flex flex-wrap gap-2">
        <input
          className="min-h-11 flex-1 rounded-md border border-border bg-background px-3"
          name="q"
          defaultValue={filters.q}
          placeholder="Search inventory…"
          aria-label="Search inventory"
        />
        <button
          type="submit"
          className="min-h-11 rounded-md border border-border px-3 py-2.5 text-sm"
        >
          Filter
        </button>
      </form>
      {items.length === 0 ? (
        <p className="text-sm text-text-secondary">No inventory items yet.</p>
      ) : (
        <ul className="rounded-md border border-border">
          {items.map((item) => (
            <InventoryCard key={item.id} householdId={householdId} item={item} />
          ))}
        </ul>
      )}
    </main>
  );
}
