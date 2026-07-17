"use client";

import { ActionForm } from "@/components/action-form";
import { createRecipeAction } from "@/app/actions/meals";
import { RECIPE_CATEGORIES } from "@/lib/meals/types";

export function RecipeForm({ householdId }: { householdId: string }) {
  return (
    <ActionForm action={createRecipeAction} pendingLabel="Saving recipe…" className="space-y-4">
      <input type="hidden" name="householdId" value={householdId} />
      <label className="block space-y-1">
        <span className="text-sm font-medium">Name</span>
        <input
          name="name"
          required
          className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Description</span>
        <textarea
          name="description"
          rows={2}
          className="w-full rounded-md border border-border bg-surface px-3 py-2"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Category</span>
          <select
            name="category"
            defaultValue="dinner"
            className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
          >
            {RECIPE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Base servings</span>
          <input
            name="baseServings"
            type="number"
            min={1}
            step="0.5"
            defaultValue={4}
            className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Visibility</span>
          <select
            name="visibility"
            defaultValue="household"
            className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
          >
            <option value="household">Household</option>
            <option value="creator_only">Creator only</option>
            <option value="selected_members">Selected members</option>
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Prep minutes</span>
          <input
            name="prepMinutes"
            type="number"
            min={0}
            className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Cook minutes</span>
          <input
            name="cookMinutes"
            type="number"
            min={0}
            className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
          />
        </label>
      </div>
      <details className="rounded-md border border-border p-3">
        <summary className="min-h-11 cursor-pointer font-medium">Ingredients (JSON)</summary>
        <textarea
          name="ingredientsJson"
          rows={6}
          defaultValue={`[{"display_name":"chicken breast","quantity":"2","quantity_unit":"pound","quantity_mode":"exact","required":true},{"display_name":"salt","quantity_mode":"to_taste","quantity_unit":"teaspoon","required":true}]`}
          className="mt-2 w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-sm"
          aria-label="Ingredients JSON"
        />
      </details>
      <details className="rounded-md border border-border p-3">
        <summary className="min-h-11 cursor-pointer font-medium">Steps (JSON)</summary>
        <textarea
          name="stepsJson"
          rows={4}
          defaultValue={`[{"step_number":1,"instruction":"Cook the chicken.","phase":"cooking"}]`}
          className="mt-2 w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-sm"
          aria-label="Steps JSON"
        />
      </details>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Source URL (reference only)</span>
        <input
          name="sourceUrl"
          type="url"
          placeholder="https://"
          className="min-h-11 w-full rounded-md border border-border bg-surface px-3"
        />
      </label>
      <button
        type="submit"
        className="min-h-11 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
      >
        Save recipe
      </button>
    </ActionForm>
  );
}
