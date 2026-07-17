import Link from "next/link";
import { AppBackButton } from "@/components/app-back-button";
import { HouseHubTabs } from "@/components/house/HouseHubTabs";
import { EmptyState } from "@/components/ui/empty-state";
import { assertActiveMembership } from "@/lib/household-context";
import { listHouseDashboard } from "@/lib/house/queries";
import { formatQuantityLabel } from "@/lib/house/quantity";

export const dynamic = "force-dynamic";

function SummarySection({
  title,
  emptyLabel,
  seeAllHref,
  rows,
}: {
  title: string;
  emptyLabel: string;
  seeAllHref: string;
  rows: Array<{ id: string; href: string; primary: string; secondary?: string }>;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          {title}
        </h2>
        <Link
          href={seeAllHref}
          className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-2 hover:underline"
        >
          See all
        </Link>
      </div>
      {rows.length === 0 ? (
        <EmptyState variant="inline" title={emptyLabel} />
      ) : (
        <ul className="rounded-md border border-border bg-surface">
          {rows.map((row) => (
            <li key={row.id} className="border-b border-border last:border-b-0">
              <Link
                href={row.href}
                className="block min-h-11 px-4 py-3.5 text-sm hover:bg-surface-interactive"
              >
                <span className="font-medium text-text-primary">{row.primary}</span>
                {row.secondary ? (
                  <span className="text-text-secondary"> · {row.secondary}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function HousePage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  await assertActiveMembership(householdId);
  const dashboard = await listHouseDashboard(householdId);
  const base = `/app/${householdId}/house`;

  const hasExceptions =
    dashboard.openShopping.count > 0 ||
    dashboard.lowSupplies.count > 0 ||
    dashboard.useSoonPantry.count > 0 ||
    dashboard.missingDamagedInventory.count > 0;

  return (
    <main className="space-y-5">
      <AppBackButton fallbackHref={`/app/${householdId}`} />
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-2xl">
          House
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Food (pantry, shopping, meals) and household property (inventory,
          supplies).
        </p>
      </header>
      <HouseHubTabs householdId={householdId} />

      {!hasExceptions && dashboard.recentRestocks.length === 0 ? (
        <EmptyState
          variant="page"
          title="Your House area is ready"
          description="Start with a pantry staple, shopping list, or household item."
          testId="house-onboarding"
          action={
            <>
              <Link
                href={`${base}/pantry`}
                className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
              >
                Add pantry staple
              </Link>
              <Link
                href={`${base}/shopping`}
                className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-medium"
              >
                Create shopping list
              </Link>
              <Link
                href={`${base}/inventory`}
                className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-medium"
              >
                Add household item
              </Link>
            </>
          }
        />
      ) : (
        <>
          <SummarySection
            title={`Shopping requests (${dashboard.openShopping.count})`}
            emptyLabel="No open shopping requests."
            seeAllHref={`${base}/shopping`}
            rows={dashboard.openShopping.items.map((item) => ({
              id: item.id,
              href: `${base}/shopping/${item.listId}`,
              primary: item.name,
              secondary: formatQuantityLabel({
                amount: item.quantity,
                unit: item.quantityUnit,
              }),
            }))}
          />

          <SummarySection
            title={`Low supplies (${dashboard.lowSupplies.count})`}
            emptyLabel="All tracked supplies look stocked."
            seeAllHref={`${base}/supplies`}
            rows={dashboard.lowSupplies.items.map((item) => ({
              id: item.id,
              href: `${base}/supplies/${item.id}`,
              primary: item.name,
              secondary: item.stockState === "out" ? "Out" : "Low",
            }))}
          />

          <SummarySection
            title={`Use soon (${dashboard.useSoonPantry.count})`}
            emptyLabel="Nothing in the pantry needs attention soon."
            seeAllHref={`${base}/pantry`}
            rows={dashboard.useSoonPantry.items.map((item) => ({
              id: item.id,
              href: `${base}/pantry/${item.id}`,
              primary: item.name,
              secondary: item.useSoonAt
                ? `Use by ${item.useSoonAt}`
                : undefined,
            }))}
          />

          <SummarySection
            title={`Missing or damaged (${dashboard.missingDamagedInventory.count})`}
            emptyLabel="No inventory needs attention."
            seeAllHref={`${base}/inventory`}
            rows={dashboard.missingDamagedInventory.items.map((item) => ({
              id: item.id,
              href: `${base}/inventory/${item.id}`,
              primary: item.name,
              secondary: item.status,
            }))}
          />

          <SummarySection
            title="Recent restocks"
            emptyLabel="No supplies have been restocked recently."
            seeAllHref={`${base}/supplies`}
            rows={dashboard.recentRestocks.map((row) => ({
              id: row.id,
              href: `${base}/supplies/${row.supplyItemId}`,
              primary: row.supplyName,
              secondary: row.newQuantity
                ? formatQuantityLabel({
                    amount: row.newQuantity,
                    unit: row.quantityUnit,
                  })
                : undefined,
            }))}
          />
        </>
      )}
    </main>
  );
}
