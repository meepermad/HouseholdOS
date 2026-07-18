"use client";

import { useActionState } from "react";
import {
  completeShoppingTripAction,
  markTripItemUnavailableAction,
  startShoppingTripAction,
} from "@/app/actions/shopping-intel";
import type { ActionResult } from "@/app/actions/auth";

export function TripControls({
  householdId,
  listId,
  tripId,
  markUnavailableItemId,
}: {
  householdId: string;
  listId: string;
  tripId: string | null;
  markUnavailableItemId?: string;
}) {
  const [startState, startAction, startPending] = useActionState(
    startShoppingTripAction,
    null as ActionResult | null,
  );
  const [completeState, completeAction, completePending] = useActionState(
    completeShoppingTripAction,
    null as ActionResult | null,
  );
  const [unavailState, unavailAction, unavailPending] = useActionState(
    markTripItemUnavailableAction,
    null as ActionResult | null,
  );

  if (markUnavailableItemId && tripId) {
    return (
      <form action={unavailAction}>
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="tripId" value={tripId} />
        <input type="hidden" name="itemId" value={markUnavailableItemId} />
        <button
          type="submit"
          disabled={unavailPending}
          className="text-sm font-medium text-text-secondary underline-offset-2 hover:underline disabled:opacity-60"
        >
          Mark unavailable
        </button>
        {unavailState && !unavailState.ok ? (
          <p className="text-xs text-danger">{unavailState.error}</p>
        ) : null}
      </form>
    );
  }

  if (!tripId) {
    return (
      <form action={startAction} className="flex flex-wrap gap-2">
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="listId" value={listId} />
        <button
          type="submit"
          disabled={startPending}
          data-testid="start-shopping-trip"
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {startPending ? "Starting…" : "Start shopping"}
        </button>
        {startState && !startState.ok ? (
          <p className="text-xs text-danger">{startState.error}</p>
        ) : null}
      </form>
    );
  }

  return (
    <form action={completeAction}>
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="tripId" value={tripId} />
      <input type="hidden" name="listId" value={listId} />
      <button
        type="submit"
        disabled={completePending}
        data-testid="complete-shopping-trip"
        className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-medium disabled:opacity-60"
      >
        {completePending ? "Finishing…" : "Complete trip"}
      </button>
      {completeState && !completeState.ok ? (
        <p className="text-xs text-danger">{completeState.error}</p>
      ) : null}
    </form>
  );
}
