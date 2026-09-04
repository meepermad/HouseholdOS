import Link from "next/link";
import { AppBackButton } from "@/components/app-back-button";
import { HouseHubTabs } from "@/components/house/HouseHubTabs";
import { EmptyState } from "@/components/ui/empty-state";
import { assertActiveMembership } from "@/lib/household-context";
import { listHouseDashboard } from "@/lib/house/queries";
import { formatQuantityLabel } from "@/lib/house/quantity";
import { inventoryStatusLabel } from "@/lib/house/display";
import { listBoardOccurrences } from "@/lib/chores/queries";
import { boardSectionForOccurrence, choreDueLabel } from "@/lib/chores/display";

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
  const ctx = await assertActiveMembership(householdId);
  const [dashboard, chores] = await Promise.all([
    listHouseDashboard(householdId),
    listBoardOccurrences(householdId, ctx.membershipId, {
      status: ["scheduled", "in_progress", "blocked", "reopened"],
      limit: 8,
    }),
  ]);
  const base = `/app/${householdId}/house`;
  const todayChores = chores.filter((chore) => {
    const section = boardSectionForOccurrence({
      status: chore.status,
      dueAt: chore.dueAt,
    });
    return section === "due_today" || section === "overdue" || section === "blocked";
  });

  const hasAttention =
    todayChores.length > 0 ||
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
          Today&apos;s chores, shopping, and household supplies.
        </p>
      </header>
      <HouseHubTabs householdId={householdId} />

      {!hasAttention && dashboard.recentRestocks.length === 0 ? (
        <EmptyState
          variant="page"
          title="Nothing needs attention"
          description="Add a shopping list, a recurring chore, or a pantry staple when you are ready."
          testId="house-onboarding"
          action={
            <>
              <Link
                href={`/app/${householdId}/chores/new`}
                className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
              >
                Add chore
              </Link>
              <Link
                href={`${base}/shopping`}
                className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-medium"
              >
                Add shopping item
              </Link>
            </>
          }
        />
      ) : (
        <>
          <SummarySection
            title="Today"
            emptyLabel="No chores need attention today."
            seeAllHref={`/app/${householdId}/chores`}
            rows={todayChores.map((chore) => ({
              id: chore.id,
              href: `/app/${householdId}/chores/${chore.id}`,
              primary: chore.title,
              secondary: choreDueLabel({
                dueAt: chore.dueAt,
                dueDate: chore.dueDate,
                allDay: chore.allDay,
              }),
            }))}
          />

          <SummarySection
            title="Shopping"
            emptyLabel="The shopping list is empty."
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
            title="Running low"
            emptyLabel="Nothing is running low."
            seeAllHref={`${base}/supplies`}
            rows={dashboard.lowSupplies.items.map((item) => ({
              id: item.id,
              href: `${base}/supplies/${item.id}`,
              primary: item.name,
              secondary: item.stockState === "out" ? "Out" : "Low",
            }))}
          />

          <SummarySection
            title="Use soon"
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
            title="Something broken or missing"
            emptyLabel="No household items need attention."
            seeAllHref={`${base}/inventory`}
            rows={dashboard.missingDamagedInventory.items.map((item) => ({
              id: item.id,
              href: `${base}/inventory/${item.id}`,
              primary: item.name,
              secondary: inventoryStatusLabel(item.status),
            }))}
          />
        </>
      )}
    </main>
  );
}
