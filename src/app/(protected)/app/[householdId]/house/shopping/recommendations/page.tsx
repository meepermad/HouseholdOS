import Link from "next/link";
import { notFound } from "next/navigation";
import { AppBackButton } from "@/components/app-back-button";
import {
  GenerateRecommendationsButton,
  RecommendationItemActions,
} from "@/components/shopping/RecommendationActions";
import { assertActiveMembership } from "@/lib/household-context";
import { getShoppingListWithItems } from "@/lib/house/queries";
import { loadLatestRecommendations } from "@/lib/shopping/recommendations/generate";
import { MODE_FILTER_LABELS } from "@/lib/shopping/recommendations/types";
import type { RecModeFilter } from "@/lib/shopping/recommendations/types";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ShoppingRecommendationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ householdId: string; listId?: string }>;
  searchParams: Promise<{ listId?: string; mode?: string }>;
}) {
  const { householdId } = await params;
  const sp = await searchParams;
  await assertActiveMembership(householdId);

  const supabase = await createClient();
  let listId = sp.listId;
  if (!listId) {
    const { data } = await supabase.rpc("ensure_default_shopping_list", {
      p_household_id: householdId,
    });
    listId = String(data);
  }

  const list = await getShoppingListWithItems(householdId, listId);
  if (!list) notFound();

  const mode = (sp.mode as RecModeFilter) || "everything";
  const latest = await loadLatestRecommendations({ householdId, listId });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loose = supabase as any;
  const { data: rediscoveries } = await loose
    .from("recipe_rediscovery_suggestions")
    .select("id,recipe_id,explanation,pantry_have,pantry_total,score,status")
    .eq("household_id", householdId)
    .eq("status", "suggested")
    .order("shown_at", { ascending: false })
    .limit(3);

  return (
    <main className="space-y-6" data-testid="shopping-recommendations">
      <AppBackButton fallbackHref={`/app/${householdId}/house/shopping/${listId}`} />
      <header className="space-y-2">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Recommended shopping
        </h1>
        <p className="text-sm text-text-secondary">
          Reviewable suggestions for {list.list.name}. Nothing is added until you confirm.
        </p>
        <GenerateRecommendationsButton
          householdId={householdId}
          listId={listId}
          mode={mode}
        />
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="Recommendation filters">
        {(Object.keys(MODE_FILTER_LABELS) as RecModeFilter[]).map((key) => (
          <Link
            key={key}
            href={`/app/${householdId}/house/shopping/recommendations?listId=${listId}&mode=${key}`}
            className={`inline-flex min-h-11 items-center rounded-md border px-3 text-sm ${
              mode === key
                ? "border-primary bg-primary/10 font-semibold"
                : "border-border"
            }`}
          >
            {MODE_FILTER_LABELS[key]}
          </Link>
        ))}
      </nav>

      {latest?.run ? (
        <p className="text-xs text-text-muted">
          Last updated {new Date(latest.run.createdAt).toLocaleString()} · scoring v1
        </p>
      ) : null}

      {!latest || latest.items.length === 0 ? (
        <p className="text-sm text-text-muted" data-testid="recommendations-empty">
          No active suggestions. Gather recommendations to compile household needs.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border bg-surface">
          {latest.items
            .filter(
              (i) =>
                mode === "everything" ||
                i.reasonCodes.some((c) =>
                  mode === "planned_meals"
                    ? c.includes("meal")
                    : mode === "running_low" || mode === "run_out_soon"
                      ? c.includes("supply")
                      : mode === "forgotten"
                        ? c.includes("forgotten")
                        : mode === "open_requests"
                          ? c.includes("request")
                          : mode === "recurring_staples"
                            ? c.includes("staple")
                            : mode === "guest_event"
                              ? true
                              : true,
                ),
            )
            .map((item) => (
              <li key={item.id} className="space-y-2 px-4 py-3" data-testid="recommendation-item">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs uppercase tracking-wide text-text-muted">
                    {item.priorityBand}
                    {item.suggestedQuantity != null
                      ? ` · ${item.suggestedQuantity} ${item.suggestedUnit}`
                      : null}
                  </p>
                </div>
                <p className="text-sm text-text-secondary">{item.explanation}</p>
                {item.confidence === "low" ? (
                  <p className="text-xs text-text-muted">
                    Estimate based on limited purchase history.
                  </p>
                ) : null}
                {item.unitMismatch ? (
                  <p className="text-xs text-warning">Unit mismatch — review quantity before adding.</p>
                ) : null}
                <RecommendationItemActions
                  householdId={householdId}
                  itemId={item.id}
                  suggestedQuantity={item.suggestedQuantity}
                  suggestedUnit={item.suggestedUnit}
                />
              </li>
            ))}
        </ul>
      )}

      {rediscoveries && rediscoveries.length > 0 ? (
        <section className="space-y-3" data-testid="forgotten-favorites-inline">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
            Meal ideas while you shop
          </h2>
          <ul className="space-y-2">
            {(rediscoveries as Array<Record<string, unknown>>).map((r) => (
              <li
                key={String(r.id)}
                className="rounded-md border border-border bg-surface px-4 py-3 text-sm"
              >
                <p>{String(r.explanation)}</p>
                <Link
                  href={`/app/${householdId}/house/recipes/rediscover`}
                  className="mt-2 inline-flex min-h-11 items-center font-semibold text-primary underline-offset-2 hover:underline"
                >
                  Review idea
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
