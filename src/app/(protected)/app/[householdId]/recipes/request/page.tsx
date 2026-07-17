import { AppBackButton } from "@/components/app-back-button";
import { HouseHubTabs } from "@/components/house/HouseHubTabs";
import { RecipeRecommendationCard } from "@/components/recipes/RecipeRecommendationCard";
import { RecipeRequestForm } from "@/components/recipes/RecipeRequestForm";
import { assertActiveMembership } from "@/lib/household-context";
import { getMealRequest } from "@/lib/meals/queries";

export const dynamic = "force-dynamic";

export default async function RecipeRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ householdId: string }>;
  searchParams: Promise<{ requestId?: string }>;
}) {
  const { householdId } = await params;
  const sp = await searchParams;
  await assertActiveMembership(householdId);
  const detail = sp.requestId
    ? await getMealRequest(householdId, sp.requestId)
    : null;

  return (
    <main className="space-y-5">
      <AppBackButton fallbackHref={`/app/${householdId}/recipes`} />
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          Recipe request
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Rank existing household recipes against pantry constraints. No AI recipe generation.
        </p>
      </header>
      <HouseHubTabs householdId={householdId} />

      {!detail ? <RecipeRequestForm householdId={householdId} /> : null}

      {detail ? (
        <section className="space-y-4">
          <h2 className="font-semibold">Recommendations</h2>
          {detail.results.length === 0 ? (
            <p className="text-sm text-text-secondary">No matching recipes.</p>
          ) : (
            detail.results.map((row: Record<string, unknown>) => {
              const recipe = row.recipes as
                | { id: string; name: string }
                | null
                | undefined;
              const reasons = Array.isArray(row.explanation)
                ? (row.explanation as string[])
                : [];
              return (
                <RecipeRecommendationCard
                  key={String(row.id)}
                  householdId={householdId}
                  mealRequestId={detail.request.id}
                  recipeId={String(row.recipe_id)}
                  name={recipe?.name ?? "Recipe"}
                  score={Number(row.score)}
                  reasons={reasons}
                  missingRequired={Number(row.missing_required)}
                />
              );
            })
          )}
        </section>
      ) : null}
    </main>
  );
}
