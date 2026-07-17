import { AppBackButton } from "@/components/app-back-button";
import { HouseHubTabs } from "@/components/house/HouseHubTabs";
import { RecipeRecommendationCard } from "@/components/recipes/RecipeRecommendationCard";
import { RecipeRequestForm } from "@/components/recipes/RecipeRequestForm";
import { assertActiveMembership } from "@/lib/household-context";
import {
  getMealRequest,
  listHouseholdMembersForMeals,
} from "@/lib/meals/queries";

export const dynamic = "force-dynamic";

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String).filter(Boolean);
}

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
  const [detail, members] = await Promise.all([
    sp.requestId ? getMealRequest(householdId, sp.requestId) : null,
    listHouseholdMembersForMeals(householdId),
  ]);

  return (
    <main className="space-y-5">
      <AppBackButton fallbackHref={`/app/${householdId}/recipes`} />
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          Recipe request
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Rank existing household recipes against pantry and preference constraints.
          No AI recipe generation.
        </p>
      </header>
      <HouseHubTabs householdId={householdId} />

      {!detail ? (
        <RecipeRequestForm householdId={householdId} members={members} />
      ) : null}

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
              const reasons = asStringArray(row.explanation);
              const warnings = asStringArray(row.warnings);
              return (
                <RecipeRecommendationCard
                  key={String(row.id)}
                  householdId={householdId}
                  mealRequestId={detail.request.id}
                  recipeId={String(row.recipe_id)}
                  name={recipe?.name ?? "Recipe"}
                  score={Number(row.score)}
                  reasons={reasons}
                  warnings={warnings}
                  preferenceFit={
                    row.preference_fit_summary
                      ? String(row.preference_fit_summary)
                      : null
                  }
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
