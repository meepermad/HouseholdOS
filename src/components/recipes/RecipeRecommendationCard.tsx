"use client";

import { ActionForm } from "@/components/action-form";
import { acceptMealRequestAction } from "@/app/actions/meals";
import { PreferenceFitSummary } from "@/components/recipes/PreferenceFitSummary";
import type { PreferenceFitSummary as PreferenceFit } from "@/lib/meals/types";

export function RecipeRecommendationCard({
  householdId,
  mealRequestId,
  recipeId,
  name,
  score,
  reasons,
  warnings = [],
  preferenceFit,
  missingRequired,
}: {
  householdId: string;
  mealRequestId: string;
  recipeId: string;
  name: string;
  score: number;
  reasons: string[];
  warnings?: string[];
  preferenceFit?: PreferenceFit | string | null;
  missingRequired: number;
}) {
  return (
    <article className="space-y-3 rounded-md border border-border bg-surface p-4 text-text-primary">
      <header className="space-y-2">
        <h3 className="text-lg font-semibold">{name}</h3>
        <p className="text-sm text-text-secondary">
          Score {score} · missing {missingRequired}
        </p>
        {preferenceFit ? <PreferenceFitSummary fit={preferenceFit} /> : null}
      </header>

      {reasons.length > 0 ? (
        <div>
          <h4 className="mb-1 text-sm font-medium text-text-primary">Why this ranks</h4>
          <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div>
          <h4 className="mb-1 text-sm font-medium text-amber-900 dark:text-amber-200">
            Warnings
          </h4>
          <ul
            className="list-disc space-y-1 pl-5 text-sm text-amber-900 dark:text-amber-200"
            role="list"
          >
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <ActionForm action={acceptMealRequestAction} pendingLabel="Planning meal…">
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="mealRequestId" value={mealRequestId} />
        <input type="hidden" name="recipeId" value={recipeId} />
        <button
          type="submit"
          className="min-h-11 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Accept recipe
        </button>
      </ActionForm>
    </article>
  );
}
