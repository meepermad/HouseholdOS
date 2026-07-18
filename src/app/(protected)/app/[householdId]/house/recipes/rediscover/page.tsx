import { AppBackButton } from "@/components/app-back-button";
import { RediscoveryActions } from "@/components/shopping/RediscoveryActions";
import { assertActiveMembership } from "@/lib/household-context";
import { generateRecipeRediscovery } from "@/lib/shopping/rediscovery/generate";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function RecipeRediscoverPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const ctx = await assertActiveMembership(householdId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  const { data: defaultList } = await supabase.rpc("ensure_default_shopping_list", {
    p_household_id: householdId,
  });

  await generateRecipeRediscovery({
    householdId,
    membershipId: ctx.membershipId,
    listId: defaultList ? String(defaultList) : null,
  }).catch(() => null);

  const { data: suggestions } = await supabase
    .from("recipe_rediscovery_suggestions")
    .select(
      "id,recipe_id,explanation,pantry_have,pantry_total,preference_fit,score,status",
    )
    .eq("household_id", householdId)
    .eq("status", "suggested")
    .order("score", { ascending: false })
    .limit(5);

  const rows = (suggestions ?? []) as Array<Record<string, unknown>>;
  const recipeIds = rows.map((r) => String(r.recipe_id));
  const { data: recipes } = recipeIds.length
    ? await supabase.from("recipes").select("id,name").in("id", recipeIds)
    : { data: [] };
  const nameById = new Map(
    ((recipes ?? []) as Array<{ id: string; name: string }>).map((r) => [
      r.id,
      r.name,
    ]),
  );

  return (
    <main className="space-y-6" data-testid="forgotten-favorites">
      <AppBackButton fallbackHref={`/app/${householdId}/house`} />
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          Forgotten Favorites
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          Occasional meal ideas you liked before. Preference authors stay private.
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="text-sm text-text-muted">
          No rediscovery suggestions right now. Cadence and feedback keep this quiet
          until a strong candidate exists.
        </p>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li
              key={String(r.id)}
              className="space-y-3 rounded-md border border-border bg-surface px-4 py-3"
              data-testid="rediscovery-card"
            >
              <h2 className="text-lg font-semibold">
                {nameById.get(String(r.recipe_id)) ?? "Recipe"}
              </h2>
              <p className="text-sm text-text-secondary">{String(r.explanation)}</p>
              <p className="text-xs text-text-muted">
                Preference fit: {String(r.preference_fit)} ·{" "}
                {Number(r.pantry_have)} of {Number(r.pantry_total)} ingredients covered
              </p>
              <RediscoveryActions
                householdId={householdId}
                suggestionId={String(r.id)}
                recipeId={String(r.recipe_id)}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
