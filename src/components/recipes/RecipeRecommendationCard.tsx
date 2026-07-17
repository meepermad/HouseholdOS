"use client";

import { ActionForm } from "@/components/action-form";
import { acceptMealRequestAction } from "@/app/actions/meals";

export function RecipeRecommendationCard({
  householdId,
  mealRequestId,
  recipeId,
  name,
  score,
  reasons,
  missingRequired,
}: {
  householdId: string;
  mealRequestId: string;
  recipeId: string;
  name: string;
  score: number;
  reasons: string[];
  missingRequired: number;
}) {
  return (
    <article className="rounded-md border border-border bg-surface p-4 space-y-3">
      <header>
        <h3 className="text-lg font-semibold">{name}</h3>
        <p className="text-sm text-text-secondary">
          Score {score} · missing {missingRequired}
        </p>
      </header>
      <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
        {reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <ActionForm action={acceptMealRequestAction} pendingLabel="Planning meal…">
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="mealRequestId" value={mealRequestId} />
        <input type="hidden" name="recipeId" value={recipeId} />
        <button
          type="submit"
          className="min-h-11 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
        >
          Accept recipe
        </button>
      </ActionForm>
    </article>
  );
}
