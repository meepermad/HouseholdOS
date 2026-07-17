"use client";

import { ActionForm } from "@/components/action-form";
import { createMealPlanAction } from "@/app/actions/meals";
import { MEAL_TYPES } from "@/lib/meals/types";

export function MealPlanForm({
  householdId,
  recipes,
}: {
  householdId: string;
  recipes: Array<{ id: string; name: string }>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <ActionForm action={createMealPlanAction} pendingLabel="Planning meal…" className="space-y-4">
      <input type="hidden" name="householdId" value={householdId} />
      <label className="block space-y-1">
        <span className="text-sm font-medium">Title</span>
        <input name="title" required className="min-h-11 w-full rounded-md border border-border bg-surface px-3" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Meal type</span>
          <select name="mealType" defaultValue="shared_household" className="min-h-11 w-full rounded-md border border-border bg-surface px-3">
            {MEAL_TYPES.map((t) => (
              <option key={t} value={t}>{t.replaceAll("_", " ")}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Date</span>
          <input name="mealDate" type="date" required defaultValue={today} className="min-h-11 w-full rounded-md border border-border bg-surface px-3" />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Recipe (optional)</span>
        <select name="recipeId" className="min-h-11 w-full rounded-md border border-border bg-surface px-3">
          <option value="">Custom / no recipe</option>
          {recipes.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Target servings</span>
          <input name="targetServings" type="number" min={1} defaultValue={4} className="min-h-11 w-full rounded-md border border-border bg-surface px-3" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Guests</span>
          <input name="guestCount" type="number" min={0} max={20} defaultValue={0} className="min-h-11 w-full rounded-md border border-border bg-surface px-3" />
        </label>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="linkCalendar" value="true" className="size-4" />
        Link calendar event
      </label>
      <button type="submit" className="min-h-11 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">
        Plan meal
      </button>
    </ActionForm>
  );
}
