"use client";

import { ActionForm } from "@/components/action-form";
import { createMealRequestAction } from "@/app/actions/meals";

export function RecipeRequestForm({ householdId }: { householdId: string }) {
  return (
    <ActionForm action={createMealRequestAction} pendingLabel="Checking pantry…" className="space-y-4">
      <input type="hidden" name="householdId" value={householdId} />
      <label className="block space-y-1">
        <span className="text-sm font-medium">Target date</span>
        <input name="targetDate" type="date" className="min-h-11 w-full rounded-md border border-border bg-surface px-3" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Guests</span>
          <input name="guestCount" type="number" min={0} max={20} defaultValue={0} className="min-h-11 w-full rounded-md border border-border bg-surface px-3" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Desired servings</span>
          <input name="desiredServings" type="number" min={1} defaultValue={4} className="min-h-11 w-full rounded-md border border-border bg-surface px-3" />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Max total minutes</span>
          <input name="maxTotalMinutes" type="number" min={0} placeholder="60" className="min-h-11 w-full rounded-md border border-border bg-surface px-3" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Max missing ingredients</span>
          <input name="maxMissingIngredients" type="number" min={0} placeholder="2" className="min-h-11 w-full rounded-md border border-border bg-surface px-3" />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Use soon / prioritize ingredient</span>
        <input name="prioritizeIngredient" placeholder="spinach" className="min-h-11 w-full rounded-md border border-border bg-surface px-3" />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Exclude ingredient</span>
        <input name="excludeIngredient" placeholder="dairy" className="min-h-11 w-full rounded-md border border-border bg-surface px-3" />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="pantryOnly" value="true" className="size-4" />
        Pantry-only recipes
      </label>
      <button type="submit" className="min-h-11 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">
        Find recipes
      </button>
    </ActionForm>
  );
}
