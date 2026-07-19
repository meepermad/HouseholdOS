"use client";

import { useActionState } from "react";
import {
  addRecommendedItemAction,
  dismissRecommendedItemAction,
  generateShoppingRecommendationsAction,
} from "@/app/actions/shopping-intel";
import type { ActionResult } from "@/app/actions/auth";

export function GenerateRecommendationsButton({
  householdId,
  listId,
  mode = "everything",
}: {
  householdId: string;
  listId: string;
  mode?: string;
}) {
  const [state, action, pending] = useActionState(
    generateShoppingRecommendationsAction,
    null as ActionResult | null,
  );
  return (
    <form action={action}>
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="listId" value={listId} />
      <input type="hidden" name="mode" value={mode} />
      <button
        type="submit"
        disabled={pending}
        data-testid="generate-shopping-recommendations"
        className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Gathering…" : "Gather recommendations"}
      </button>
      {state && !state.ok ? (
        <p className="mt-1 text-xs text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export function RecommendationItemActions({
  householdId,
  itemId,
  suggestedQuantity,
  suggestedUnit,
}: {
  householdId: string;
  itemId: string;
  suggestedQuantity: number | null;
  suggestedUnit: string;
}) {
  const [addState, addAction, addPending] = useActionState(
    addRecommendedItemAction,
    null as ActionResult | null,
  );
  const [dismissState, dismissAction, dismissPending] = useActionState(
    dismissRecommendedItemAction,
    null as ActionResult | null,
  );

  return (
    <div className="flex flex-wrap gap-2">
      <form action={addAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="itemId" value={itemId} />
        <label className="text-xs text-text-muted">
          Qty
          <input
            name="quantity"
            type="number"
            step="any"
            defaultValue={suggestedQuantity ?? undefined}
            className="ml-1 min-h-11 w-20 rounded-md border border-border bg-background px-2 text-sm"
            aria-label="Suggested quantity"
          />
        </label>
        <input type="hidden" name="unit" value={suggestedUnit} />
        <button
          type="submit"
          disabled={addPending}
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          data-testid="add-recommendation"
        >
          Add
        </button>
      </form>
      <form action={dismissAction}>
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="itemId" value={itemId} />
        <input type="hidden" name="decision" value="dismissed" />
        <button
          type="submit"
          disabled={dismissPending}
          className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm disabled:opacity-60"
        >
          Not this trip
        </button>
      </form>
      <form action={dismissAction}>
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="itemId" value={itemId} />
        <input type="hidden" name="decision" value="snoozed" />
        <input type="hidden" name="snoozeDays" value="14" />
        <button
          type="submit"
          disabled={dismissPending}
          className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm disabled:opacity-60"
          data-testid="snooze-recommendation"
        >
          Remind next trip
        </button>
      </form>
      <form action={dismissAction}>
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="itemId" value={itemId} />
        <input type="hidden" name="decision" value="suppress_auto" />
        <button
          type="submit"
          disabled={dismissPending}
          className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm disabled:opacity-60"
          data-testid="suppress-recommendation"
        >
          Do not suggest automatically
        </button>
      </form>
      {(addState && !addState.ok) || (dismissState && !dismissState.ok) ? (
        <p className="w-full text-xs text-danger" role="alert">
          {(!addState?.ok && addState?.error) ||
            (!dismissState?.ok && dismissState?.error)}
        </p>
      ) : null}
    </div>
  );
}
