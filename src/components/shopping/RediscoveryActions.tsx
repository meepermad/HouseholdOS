"use client";

import { useActionState } from "react";
import { decideRediscoveryAction } from "@/app/actions/shopping-intel";
import type { ActionResult } from "@/app/actions/auth";
import Link from "next/link";

export function RediscoveryActions({
  householdId,
  suggestionId,
  recipeId,
  householdName,
}: {
  householdId: string;
  suggestionId: string;
  recipeId: string;
  householdName?: string;
}) {
  const [state, action, pending] = useActionState(
    decideRediscoveryAction,
    null as ActionResult | null,
  );

  return (
    <div className="flex flex-wrap gap-2" data-testid="rediscovery-actions">
      {householdName ? (
        <p className="w-full text-xs text-text-muted" data-testid="household-context-label">
          Household: {householdName}
        </p>
      ) : null}
      <Link
        href={`/app/${householdId}/meals/new?recipeId=${recipeId}`}
        className="inline-flex min-h-11 items-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground"
        data-testid="plan-rediscovered-meal"
      >
        Plan this meal
      </Link>
      <Link
        href={`/app/${householdId}/house/recipes/rediscover/${suggestionId}/ingredients`}
        className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm font-semibold"
        data-testid="add-missing-ingredients"
      >
        Add missing ingredients
      </Link>
      {(
        [
          ["save_for_later", "Save for later"],
          ["not_this_time", "Not this time"],
          ["remind_next_month", "Remind us next month"],
          ["recently_had", "We had this recently"],
          ["suppress", "Do not suggest"],
        ] as const
      ).map(([decision, label]) => (
        <form key={decision} action={action}>
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="suggestionId" value={suggestionId} />
          <input type="hidden" name="decision" value={decision} />
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm disabled:opacity-60"
            data-testid={`rediscovery-${decision}`}
          >
            {label}
          </button>
        </form>
      ))}
      {state && !state.ok ? (
        <p className="w-full text-xs text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
