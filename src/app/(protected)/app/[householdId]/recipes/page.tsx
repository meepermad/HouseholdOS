import Link from "next/link";
import { AppBackButton } from "@/components/app-back-button";
import { HouseHubTabs } from "@/components/house/HouseHubTabs";
import { assertActiveMembership } from "@/lib/household-context";
import { listRecipes } from "@/lib/meals/queries";

export const dynamic = "force-dynamic";

export default async function RecipesPage({
  params,
  searchParams,
}: {
  params: Promise<{ householdId: string }>;
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { householdId } = await params;
  const sp = await searchParams;
  await assertActiveMembership(householdId);
  const recipes = await listRecipes(householdId, {
    search: sp.q,
    category: sp.category,
  });

  return (
    <main className="space-y-5">
      <AppBackButton fallbackHref={`/app/${householdId}/house`} />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">Recipes</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Household and personal recipes. Pantry matching stays approximate.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/app/${householdId}/recipes/request`}
            className="min-h-11 rounded-md border border-border px-3 py-2.5 text-sm font-medium"
          >
            Request ideas
          </Link>
          <Link
            href={`/app/${householdId}/recipes/new`}
            className="min-h-11 rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground"
          >
            New recipe
          </Link>
        </div>
      </header>
      <HouseHubTabs householdId={householdId} />

      <form className="flex flex-wrap gap-2" method="get">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search recipes"
          className="min-h-11 flex-1 rounded-md border border-border bg-surface px-3"
          aria-label="Search recipes"
        />
        <button type="submit" className="min-h-11 rounded-md border border-border px-3 text-sm font-medium">
          Search
        </button>
      </form>

      {recipes.length === 0 ? (
        <p className="text-sm text-text-secondary">No recipes yet.</p>
      ) : (
        <ul className="rounded-md border border-border divide-y divide-border">
          {recipes.map((r) => (
            <li key={r.id}>
              <Link
                href={`/app/${householdId}/recipes/${r.id}`}
                className="block min-h-11 px-4 py-3.5 hover:bg-surface-interactive"
              >
                <span className="font-medium">{r.name}</span>
                <span className="text-text-secondary">
                  {" "}
                  · {r.category.replaceAll("_", " ")} · {r.baseServings} servings
                  {r.totalMinutes != null ? ` · ${r.totalMinutes} min` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
