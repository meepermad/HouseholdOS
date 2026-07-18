"use client";

import { useActionState } from "react";
import { decideRediscoveryAction } from "@/app/actions/shopping-intel";
import type { ActionResult } from "@/app/actions/auth";
import Link from "next/link";

export function RediscoveryActions({
  householdId,
  suggestionId,
  recipeId,
}: {
  householdId: string;
  suggestionId: string;
  recipeId: string;
}) {
  const [state, action, pending] = useActionState(
    decideRediscoveryAction,
    null as ActionResult | null,
  );

  return (
    <div className="flex flex-wrap gap-2" data-testid="rediscovery-actions">
      <Link
        href={`/app/${householdId}/meals/new?recipeId=${recipeId}`}
        className="inline-flex min-h-11 items-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground"
      >
        Plan this meal
      </Link>
      {(
        [
          ["add_ingredients", "Add missing ingredients"],
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
