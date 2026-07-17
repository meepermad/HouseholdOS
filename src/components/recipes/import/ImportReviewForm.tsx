"use client";

import { useState } from "react";
import { saveImportedRecipeAction } from "@/app/actions/recipe-import";
import { ActionForm } from "@/components/action-form";
import { RECIPE_CATEGORIES } from "@/lib/meals/types";

type Ingredient = {
  originalText?: string;
  display_name?: string;
  quantity?: string | number | null;
  quantity_unit?: string;
  quantity_mode?: string;
  preparation_note?: string | null;
  ingredient_group?: string | null;
  required?: boolean;
  confidence?: number;
};

type Step = {
  step_number?: number;
  instruction?: string;
  section?: string | null;
  phase?: string;
};

type ReviewRecipe = {
  name?: string;
  description?: string | null;
  category?: string;
  cuisine?: string | null;
  baseServings?: number | null;
  yieldText?: string | null;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  totalMinutes?: number | null;
  author?: string | null;
  imageUrl?: string | null;
  tags?: string[];
  ingredients?: Ingredient[];
  steps?: Step[];
  equipment?: Array<{ display_name?: string } | string>;
};

function text(value: unknown) {
  return value == null ? "" : String(value);
}

export function ImportReviewForm({
  householdId,
  draftId,
  initialRecipe,
  warnings,
  sourceHostname,
  duplicate,
}: {
  householdId: string;
  draftId: string;
  initialRecipe: ReviewRecipe;
  warnings: string[];
  sourceHostname: string;
  duplicate?: { id: string; name: string } | null;
}) {
  const [recipe, setRecipe] = useState<ReviewRecipe>(initialRecipe);
  const ingredients = recipe.ingredients ?? [];
  const steps = recipe.steps ?? [];
  const patch = <K extends keyof ReviewRecipe>(
    key: K,
    value: ReviewRecipe[K],
  ) => setRecipe((current) => ({ ...current, [key]: value }));

  return (
    <ActionForm
      action={saveImportedRecipeAction}
      pendingLabel="Saving imported recipe…"
      className="space-y-6"
    >
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="draftId" value={draftId} />
      <input type="hidden" name="recipeJson" value={JSON.stringify(recipe)} />

      <section
        aria-label="Import confidence"
        className="space-y-2 border-l-4 border-warning pl-4"
      >
        <p className="font-medium">
          Review required · imported from {sourceHostname}
        </p>
        {warnings.length ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-secondary">
            Structured fields were extracted confidently. Check them before saving.
          </p>
        )}
      </section>

      {duplicate ? (
        <section className="space-y-2 border-l-4 border-warning pl-4">
          <p className="font-medium">Exact source already imported</p>
          <a
            href={`/app/${householdId}/recipes/${duplicate.id}`}
            className="inline-block min-h-11 py-2.5 text-sm font-medium text-primary underline"
          >
            Open {duplicate.name}
          </a>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="importAsCopy" value="true" />
            Import as a separate copy
          </label>
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 sm:col-span-2">
          <span className="text-sm font-medium">Recipe name</span>
          <input
            required
            value={recipe.name ?? ""}
            onChange={(event) => patch("name", event.target.value)}
            className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">Category</span>
          <select
            value={recipe.category ?? "other"}
            onChange={(event) => patch("category", event.target.value)}
            className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
          >
            {RECIPE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">Cuisine</span>
          <input
            value={recipe.cuisine ?? ""}
            onChange={(event) => patch("cuisine", event.target.value)}
            className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">Serving count</span>
          <input
            type="number"
            min="0.25"
            step="0.25"
            value={recipe.baseServings ?? ""}
            onChange={(event) =>
              patch(
                "baseServings",
                event.target.value ? Number(event.target.value) : null,
              )
            }
            className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">Yield text</span>
          <input
            value={recipe.yieldText ?? ""}
            onChange={(event) => patch("yieldText", event.target.value)}
            className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
          />
        </label>
        {(["prepMinutes", "cookMinutes", "totalMinutes"] as const).map((key) => (
          <label className="space-y-1" key={key}>
            <span className="text-sm font-medium">
              {key.replace("Minutes", "")} minutes
            </span>
            <input
              type="number"
              min="0"
              value={recipe[key] ?? ""}
              onChange={(event) =>
                patch(key, event.target.value ? Number(event.target.value) : null)
              }
              className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
            />
          </label>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-2xl">
          Ingredients
        </h2>
        {ingredients.map((ingredient, index) => (
          <fieldset
            key={`${ingredient.originalText ?? "ingredient"}-${index}`}
            className="grid gap-3 border-l-2 border-border pl-3 sm:grid-cols-4"
          >
            <legend className="mb-2 text-sm text-text-secondary sm:col-span-4">
              Original: {ingredient.originalText ?? ingredient.display_name}
            </legend>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-medium">Ingredient</span>
              <input
                value={ingredient.display_name ?? ""}
                onChange={(event) => {
                  const next = [...ingredients];
                  next[index] = { ...ingredient, display_name: event.target.value };
                  patch("ingredients", next);
                }}
                className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium">Quantity</span>
              <input
                value={text(ingredient.quantity)}
                onChange={(event) => {
                  const next = [...ingredients];
                  next[index] = { ...ingredient, quantity: event.target.value || null };
                  patch("ingredients", next);
                }}
                className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium">Unit</span>
              <input
                value={ingredient.quantity_unit ?? "unknown"}
                onChange={(event) => {
                  const next = [...ingredients];
                  next[index] = {
                    ...ingredient,
                    quantity_unit: event.target.value,
                  };
                  patch("ingredients", next);
                }}
                className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
              />
            </label>
          </fieldset>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-2xl">
          Instructions
        </h2>
        {steps.map((step, index) => (
          <label className="block space-y-1" key={index}>
            <span className="text-xs font-medium">
              {step.section ? `${step.section} · ` : ""}Step {index + 1}
            </span>
            <textarea
              rows={3}
              value={step.instruction ?? ""}
              onChange={(event) => {
                const next = [...steps];
                next[index] = {
                  ...step,
                  step_number: index + 1,
                  instruction: event.target.value,
                };
                patch("steps", next);
              }}
              className="w-full rounded-md border border-border bg-surface px-3 py-2"
            />
          </label>
        ))}
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-sm font-medium">Source author</span>
          <input
            value={recipe.author ?? ""}
            onChange={(event) => patch("author", event.target.value)}
            className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">Save visibility</span>
          <select
            name="visibility"
            defaultValue="household"
            className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
          >
            <option value="household">Household</option>
            <option value="creator_only">Creator only</option>
          </select>
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="text-sm font-medium">Source image URL</span>
          <input
            type="url"
            value={recipe.imageUrl ?? ""}
            onChange={(event) => patch("imageUrl", event.target.value || null)}
            className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
          />
        </label>
      </div>

      <button
        type="submit"
        className="min-h-11 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
      >
        Save recipe
      </button>
    </ActionForm>
  );
}
