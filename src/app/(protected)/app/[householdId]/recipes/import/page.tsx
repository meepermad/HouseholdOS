import Link from "next/link";
import { AppBackButton } from "@/components/app-back-button";
import { HouseHubTabs } from "@/components/house/HouseHubTabs";
import { RecipeImportForm } from "@/components/recipes/import/RecipeImportForm";
import { assertActiveMembership } from "@/lib/household-context";

export const dynamic = "force-dynamic";

export default async function RecipeImportPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  await assertActiveMembership(householdId);

  return (
    <main className="space-y-6">
      <AppBackButton fallbackHref={`/app/${householdId}/recipes`} />
      <header className="max-w-2xl space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-text-secondary">
          Recipes
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          Import from a public page
        </h1>
        <p className="text-sm text-text-secondary">
          Extract the cooking details, review uncertain fields, then save into
          the same recipe library used by pantry matching and meal plans.
        </p>
      </header>
      <HouseHubTabs householdId={householdId} />
      <div className="max-w-2xl">
        <RecipeImportForm householdId={householdId} />
      </div>
      <nav aria-label="Import alternatives" className="flex flex-wrap gap-4 text-sm">
        <Link className="font-medium text-primary underline" href={`/app/${householdId}/recipes/new`}>
          Enter recipe manually
        </Link>
        <Link className="font-medium text-primary underline" href={`/app/${householdId}/recipes/new`}>
          Paste recipe text manually
        </Link>
      </nav>
    </main>
  );
}
