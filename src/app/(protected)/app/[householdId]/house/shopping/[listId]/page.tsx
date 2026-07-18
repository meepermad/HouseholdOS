import { notFound } from "next/navigation";
import Link from "next/link";
import { AppBackButton } from "@/components/app-back-button";
import { HouseHubTabs } from "@/components/house/HouseHubTabs";
import { ShoppingListView } from "@/components/house/ShoppingListView";
import { assertActiveMembership } from "@/lib/household-context";
import { getShoppingListWithItems } from "@/lib/house/queries";

export const dynamic = "force-dynamic";

export default async function ShoppingListPage({
  params,
}: {
  params: Promise<{ householdId: string; listId: string }>;
}) {
  const { householdId, listId } = await params;
  const ctx = await assertActiveMembership(householdId);
  const result = await getShoppingListWithItems(householdId, listId);
  if (!result) notFound();

  return (
    <main className="space-y-5">
      <AppBackButton fallbackHref={`/app/${householdId}/house`} />
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">{result.list.name}</h1>
        <p className="mt-1 text-sm text-text-secondary">
          {result.list.storeLabel ? `${result.list.storeLabel} · ` : null}
          Mobile-friendly grocery trip list.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`/app/${householdId}/house/shopping/${listId}/trip`}
            className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
            data-testid="open-shopping-trip"
          >
            Start shopping
          </Link>
          <Link
            href={`/app/${householdId}/house/shopping/recommendations?listId=${listId}`}
            className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-medium"
            data-testid="open-shopping-recommendations"
          >
            Review recommendations
          </Link>
          <Link
            href={`/app/${householdId}/house/recipes/rediscover`}
            className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-medium"
          >
            Forgotten Favorites
          </Link>
        </div>
      </header>
      <HouseHubTabs householdId={householdId} />
      <ShoppingListView
        householdId={householdId}
        listId={listId}
        items={result.items}
        currentMembershipId={ctx.membershipId}
      />
    </main>
  );
}
