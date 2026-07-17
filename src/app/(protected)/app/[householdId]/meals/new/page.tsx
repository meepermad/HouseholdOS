import { AppBackButton } from "@/components/app-back-button";
import { HouseHubTabs } from "@/components/house/HouseHubTabs";
import { MealPlanForm } from "@/components/meals/MealPlanForm";
import { assertActiveMembership } from "@/lib/household-context";
import { listRecipes } from "@/lib/meals/queries";

export const dynamic = "force-dynamic";

export default async function NewMealPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  await assertActiveMembership(householdId);
  const recipes = await listRecipes(householdId, { limit: 100 });

  return (
    <main className="space-y-5">
      <AppBackButton fallbackHref={`/app/${householdId}/meals`} />
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Plan a meal</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Shared, personal, open, guest-inclusive, or meal prep — not every day needs a plan.
        </p>
      </header>
      <HouseHubTabs householdId={householdId} />
      <MealPlanForm
        householdId={householdId}
        recipes={recipes.map((r) => ({ id: r.id, name: r.name }))}
      />
    </main>
  );
}
