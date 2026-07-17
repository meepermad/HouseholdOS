"use client";

import { ActionForm } from "@/components/action-form";
import { createMealRequestAction } from "@/app/actions/meals";
import { RecommendationModeSelector } from "@/components/recipes/RecommendationModeSelector";
import { MEAL_TYPES, PREFERENCE_SCOPES } from "@/lib/meals/types";

export type RecipeRequestMember = {
  id: string;
  displayName: string;
};

export function RecipeRequestForm({
  householdId,
  members,
}: {
  householdId: string;
  members?: RecipeRequestMember[];
}) {
  return (
    <ActionForm
      action={createMealRequestAction}
      pendingLabel="Checking pantry…"
      className="space-y-4"
    >
      <input type="hidden" name="householdId" value={householdId} />

      <label className="block space-y-1">
        <span className="text-sm font-medium">Meal type</span>
        <select
          name="mealType"
          defaultValue="shared_household"
          className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-text-primary"
        >
          {MEAL_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>

      <RecommendationModeSelector />

      <label className="block space-y-1">
        <span className="text-sm font-medium">Preference scope</span>
        <select
          name="preferenceScope"
          defaultValue="attendees"
          className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-text-primary"
        >
          {PREFERENCE_SCOPES.map((scope) => (
            <option key={scope} value={scope}>
              {scope === "attendees" ? "Attendees only" : "Whole household"}
            </option>
          ))}
        </select>
      </label>

      {members && members.length > 0 ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Attendees</legend>
          <p className="text-xs text-text-muted">
            Select who this meal is for when ranking preferences.
          </p>
          <ul className="space-y-1">
            {members.map((member) => (
              <li key={member.id}>
                <label className="flex min-h-11 items-center gap-2 text-sm text-text-primary">
                  <input
                    type="checkbox"
                    name="attendeeMembershipIds"
                    value={member.id}
                    className="size-4 rounded border-border accent-primary"
                  />
                  {member.displayName}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ) : null}

      <label className="block space-y-1">
        <span className="text-sm font-medium">Target date</span>
        <input
          name="targetDate"
          type="date"
          className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-text-primary"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Guests</span>
          <input
            name="guestCount"
            type="number"
            min={0}
            max={20}
            defaultValue={0}
            className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-text-primary"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Desired servings</span>
          <input
            name="desiredServings"
            type="number"
            min={1}
            defaultValue={4}
            className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-text-primary"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Max total minutes</span>
          <input
            name="maxTotalMinutes"
            type="number"
            min={0}
            placeholder="60"
            className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-text-primary"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Max missing ingredients</span>
          <input
            name="maxMissingIngredients"
            type="number"
            min={0}
            placeholder="2"
            className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-text-primary"
          />
        </label>
      </div>

      <label className="flex min-h-11 items-center gap-2 text-sm text-text-primary">
        <input
          type="checkbox"
          name="strictTimeLimit"
          value="true"
          className="size-4 rounded border-border accent-primary"
        />
        Treat max minutes as a hard limit
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Guest dietary constraints</span>
        <input
          name="guestConstraintLabels"
          placeholder="nut allergy, vegetarian guest"
          className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-text-primary"
        />
        <span className="text-xs text-text-muted">
          Comma-separated labels for this meal only.
        </span>
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Dietary constraint</span>
        <input
          name="dietaryConstraint"
          placeholder="gluten-free"
          className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-text-primary"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Use soon / prioritize ingredient</span>
        <input
          name="prioritizeIngredient"
          placeholder="spinach"
          className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-text-primary"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Exclude ingredient</span>
        <input
          name="excludeIngredient"
          placeholder="dairy"
          className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-text-primary"
        />
      </label>

      <label className="flex min-h-11 items-center gap-2 text-sm text-text-primary">
        <input
          type="checkbox"
          name="pantryOnly"
          value="true"
          className="size-4 rounded border-border accent-primary"
        />
        Pantry-only recipes
      </label>

      <button
        type="submit"
        className="min-h-11 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        Find recipes
      </button>
    </ActionForm>
  );
}
