import Link from "next/link";
import { notFound } from "next/navigation";
import { AppBackButton } from "@/components/app-back-button";
import { ShoppingItemRow } from "@/components/house/ShoppingItemRow";
import {
  GenerateRecommendationsButton,
  RecommendationItemActions,
} from "@/components/shopping/RecommendationActions";
import { TripControls } from "@/components/shopping/TripControls";
import { assertActiveMembership } from "@/lib/household-context";
import { getShoppingListWithItems } from "@/lib/house/queries";
import { loadLatestRecommendations } from "@/lib/shopping/recommendations/generate";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const OPEN = new Set(["requested", "approved", "assigned", "in_cart"]);

export default async function ShoppingTripPage({
  params,
  searchParams,
}: {
  params: Promise<{ householdId: string; listId: string }>;
  searchParams: Promise<{ tripId?: string }>;
}) {
  const { householdId, listId } = await params;
  const { tripId } = await searchParams;
  const ctx = await assertActiveMembership(householdId);
  const result = await getShoppingListWithItems(householdId, listId);
  if (!result) notFound();

  const open = result.items.filter((i) => OPEN.has(i.status));
  const done = result.items.filter((i) => !OPEN.has(i.status));
  const latest = await loadLatestRecommendations({ householdId, listId });
  const suggestions = (latest?.items ?? []).slice(0, 3);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loose = (await createClient()) as any;
  const { data: stillNeeded } = await loose
    .from("shopping_trip_events")
    .select("shopping_item_id")
    .eq("household_id", householdId)
    .eq("event_type", "still_needed")
    .order("created_at", { ascending: false })
    .limit(20);
  const stillIds = new Set(
    ((stillNeeded ?? []) as Array<{ shopping_item_id: string | null }>)
      .map((e) => e.shopping_item_id)
      .filter(Boolean),
  );
  const stillItems = open.filter((i) => stillIds.has(i.id));

  return (
    <main className="space-y-5 pb-24" data-testid="shopping-trip-mode">
      <AppBackButton fallbackHref={`/app/${householdId}/house/shopping/${listId}`} />
      <header className="space-y-1">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Shopping{result.list.storeLabel ? ` at ${result.list.storeLabel}` : ""}
        </h1>
        <p className="text-sm text-text-secondary">
          Large checkboxes for the trip. No location tracking.
        </p>
        <TripControls
          householdId={householdId}
          listId={listId}
          tripId={tripId ?? null}
        />
      </header>

      {stillItems.length > 0 ? (
        <section className="space-y-2" data-testid="still-needed">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
            Still needed from last time
          </h2>
          <ul className="rounded-md border border-border bg-surface">
            {stillItems.map((item) => (
              <ShoppingItemRow
                key={item.id}
                householdId={householdId}
                item={item}
                currentMembershipId={ctx.membershipId}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Still needed
        </h2>
        {open.length === 0 ? (
          <p className="text-sm text-text-muted">Everything on this list is complete.</p>
        ) : (
          <ul className="rounded-md border border-border bg-surface">
            {open.map((item) => (
              <li key={item.id} className="border-b border-border last:border-0">
                <ShoppingItemRow
                  householdId={householdId}
                  item={item}
                  currentMembershipId={ctx.membershipId}
                />
                {tripId ? (
                  <div className="px-4 pb-3">
                    <TripControls
                      householdId={householdId}
                      listId={listId}
                      tripId={tripId}
                      markUnavailableItemId={item.id}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2" data-testid="trip-recommended-additions">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
            You may also need
          </h2>
          <Link
            href={`/app/${householdId}/house/shopping/recommendations?listId=${listId}`}
            className="text-sm font-medium text-primary underline-offset-2 hover:underline"
          >
            Review all suggestions
          </Link>
        </div>
        {suggestions.length === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-text-muted">No compact suggestions yet.</p>
            <GenerateRecommendationsButton householdId={householdId} listId={listId} />
          </div>
        ) : (
          <ul className="space-y-2">
            {suggestions.map((s) => (
              <li
                key={s.id}
                className="rounded-md border border-border bg-surface px-4 py-3 space-y-2"
              >
                <p className="font-medium">{s.name}</p>
                <p className="text-sm text-text-secondary">{s.explanation}</p>
                <RecommendationItemActions
                  householdId={householdId}
                  itemId={s.id}
                  suggestedQuantity={s.suggestedQuantity}
                  suggestedUnit={s.suggestedUnit}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {done.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
            Completed
          </h2>
          <ul className="rounded-md border border-border bg-surface-secondary">
            {done.map((item) => (
              <ShoppingItemRow
                key={item.id}
                householdId={householdId}
                item={item}
                currentMembershipId={ctx.membershipId}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
