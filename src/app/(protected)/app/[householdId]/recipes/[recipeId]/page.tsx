import Link from "next/link";
import { notFound } from "next/navigation";
import { AppBackButton } from "@/components/app-back-button";
import { HouseHubTabs } from "@/components/house/HouseHubTabs";
import { assertActiveMembership } from "@/lib/household-context";
import { getRecipe } from "@/lib/meals/queries";
import { scaleIngredients } from "@/lib/meals/scale";
import type { QuantityUnit } from "@/lib/house/types";
import type { QuantityMode } from "@/lib/meals/types";

export const dynamic = "force-dynamic";

export default async function RecipeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ householdId: string; recipeId: string }>;
  searchParams: Promise<{ servings?: string }>;
}) {
  const { householdId, recipeId } = await params;
  const sp = await searchParams;
  await assertActiveMembership(householdId);
  const detail = await getRecipe(householdId, recipeId);
  if (!detail) notFound();
  const { recipe, ingredients, steps, equipment } = detail;
  const target = Number(sp.servings ?? recipe.base_servings);
  const scaled = scaleIngredients(
    ingredients.map((ing: Record<string, unknown>) => ({
      id: String(ing.id),
      displayName: String(ing.display_name),
      quantity: ing.quantity != null ? String(ing.quantity) : null,
      unit: (ing.quantity_unit as QuantityUnit) ?? "item",
      quantityMode: (ing.quantity_mode as QuantityMode) ?? "exact",
      required: Boolean(ing.required),
    })),
    Number(recipe.base_servings),
    Number.isFinite(target) && target > 0 ? target : Number(recipe.base_servings),
  );

  return (
    <main className="space-y-5">
      <AppBackButton fallbackHref={`/app/${householdId}/recipes`} />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">{recipe.name}</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Base {recipe.base_servings} servings
            {recipe.total_minutes != null ? ` · ${recipe.total_minutes} min` : ""}
            {" · "}
            {String(recipe.visibility).replaceAll("_", " ")}
          </p>
        </div>
        <Link
          href={`/app/${householdId}/meals/new`}
          className="min-h-11 rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground"
        >
          Plan meal
        </Link>
      </header>
      <HouseHubTabs householdId={householdId} />

      <form method="get" className="flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Scale to servings</span>
          <input
            name="servings"
            type="number"
            min={1}
            step="0.5"
            defaultValue={target}
            className="block min-h-11 rounded-md border border-border bg-surface px-3"
          />
        </label>
        <button type="submit" className="min-h-11 rounded-md border border-border px-3 text-sm font-medium">
          Calculate servings
        </button>
      </form>

      <section className="space-y-2">
        <h2 className="font-semibold">Ingredients</h2>
        <ul className="rounded-md border border-border divide-y divide-border">
          {(scaled.ok ? scaled.ingredients : []).map((ing) => (
            <li key={ing.id} className="px-4 py-3 text-sm">
              <span className="font-medium">{ing.displayName}</span>
              {ing.scaledQuantity != null ? (
                <span className="text-text-secondary">
                  {" "}
                  · {ing.scaledQuantity} {ing.unit}
                  {ing.scaledNumerically && ing.baseQuantity !== ing.scaledQuantity
                    ? ` (from ${ing.baseQuantity})`
                    : ""}
                </span>
              ) : (
                <span className="text-text-secondary"> · {ing.quantityMode.replaceAll("_", " ")}</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Steps</h2>
        <ol className="list-decimal space-y-2 pl-5">
          {steps.map((s: Record<string, unknown>) => (
            <li key={String(s.id)} className="text-sm">
              {String(s.instruction)}
            </li>
          ))}
        </ol>
      </section>

      {equipment.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-semibold">Equipment</h2>
          <ul className="text-sm text-text-secondary">
            {equipment.map((e: Record<string, unknown>) => (
              <li key={String(e.id)}>{String(e.display_name)}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
