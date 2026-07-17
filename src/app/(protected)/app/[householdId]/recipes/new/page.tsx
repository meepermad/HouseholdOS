import { AppBackButton } from "@/components/app-back-button";
import { HouseHubTabs } from "@/components/house/HouseHubTabs";
import { RecipeForm } from "@/components/recipes/RecipeForm";
import { assertActiveMembership } from "@/lib/household-context";

export const dynamic = "force-dynamic";

export default async function NewRecipePage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  await assertActiveMembership(householdId);
  return (
    <main className="space-y-5">
      <AppBackButton fallbackHref={`/app/${householdId}/recipes`} />
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">New recipe</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Manual entry only. Source URLs are attribution — pages are not scraped.
        </p>
      </header>
      <HouseHubTabs householdId={householdId} />
      <RecipeForm householdId={householdId} />
    </main>
  );
}
