import Link from "next/link";
import { notFound } from "next/navigation";
import { AppBackButton } from "@/components/app-back-button";
import { HouseHubTabs } from "@/components/house/HouseHubTabs";
import { ActionForm } from "@/components/action-form";
import { refreshRecipeSourceAction } from "@/app/actions/recipe-import";
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
  const sourceImage = safeSourceImage(
    recipe.source_image_url,
    recipe.source_hostname,
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

      {recipe.source_type === "imported" && recipe.source_hostname ? (
        <section
          aria-label="Recipe source attribution"
          className="grid gap-4 border-l-4 border-border pl-4 sm:grid-cols-[1fr_auto]"
        >
          <div>
            <p className="font-medium">
              Imported from {String(recipe.source_hostname)}
            </p>
            {recipe.source_author ? (
              <p className="text-sm text-text-secondary">
                Original recipe by {String(recipe.source_author)}
              </p>
            ) : null}
            <a
              href={String(recipe.source_canonical_url ?? recipe.source_url)}
              rel="noopener noreferrer"
              target="_blank"
              className="mt-2 inline-block min-h-11 py-2.5 text-sm font-medium text-primary underline"
            >
              View source
            </a>
            {recipe.source_url ? (
              <ActionForm
                action={refreshRecipeSourceAction}
                pendingLabel="Checking source…"
                className="mt-1"
              >
                <input type="hidden" name="householdId" value={householdId} />
                <input type="hidden" name="recipeId" value={recipeId} />
                <input type="hidden" name="sourceUrl" value={String(recipe.source_url)} />
                <button
                  type="submit"
                  className="min-h-11 text-sm font-medium text-text-secondary underline"
                >
                  Check source for updates
                </button>
              </ActionForm>
            ) : null}
          </div>
          {sourceImage ? (
            // The URL was SSRF-validated at import and must remain on the source host.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sourceImage}
              alt=""
              referrerPolicy="no-referrer"
              loading="lazy"
              className="h-28 w-40 object-cover"
            />
          ) : null}
        </section>
      ) : null}

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

function safeSourceImage(value: unknown, expectedHostname: unknown) {
  if (typeof value !== "string" || typeof expectedHostname !== "string") {
    return null;
  }
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname.toLowerCase() !== expectedHostname.toLowerCase() ||
      url.username ||
      url.password
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}
