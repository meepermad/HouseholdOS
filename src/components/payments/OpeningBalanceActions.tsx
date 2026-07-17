"use client";

import { useActionState } from "react";
import {
  cancelOpeningBalanceAction,
  respondOpeningBalanceAction,
  submitOpeningBalanceAction,
} from "@/app/actions/opening-balances";

export function OpeningBalanceActions({
  householdId,
  entryId,
  status,
  isParty,
  isCreator,
}: {
  householdId: string;
  entryId: string;
  status: string;
  isParty: boolean;
  isCreator: boolean;
}) {
  return (
    <div className="space-y-3" data-testid="opening-balance-actions">
      {isCreator && status === "draft" ? (
        <SimpleObAction
          householdId={householdId}
          entryId={entryId}
          action={submitOpeningBalanceAction}
          label="Submit for confirmation"
        />
      ) : null}
      {isParty && status === "awaiting_confirmation" ? (
        <>
          <Decision
            householdId={householdId}
            entryId={entryId}
            decision="approved"
            label="Confirm opening balance"
          />
          <Decision
            householdId={householdId}
            entryId={entryId}
            decision="rejected"
            label="Reject"
          />
        </>
      ) : null}
      {isCreator && (status === "draft" || status === "awaiting_confirmation") ? (
        <SimpleObAction
          householdId={householdId}
          entryId={entryId}
          action={cancelOpeningBalanceAction}
          label="Cancel"
        />
      ) : null}
    </div>
  );
}

function Decision({
  householdId,
  entryId,
  decision,
  label,
}: {
  householdId: string;
  entryId: string;
  decision: "approved" | "rejected";
  label: string;
}) {
  const [state, action, pending] = useActionState(respondOpeningBalanceAction, null);
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="entryId" value={entryId} />
      <input type="hidden" name="decision" value={decision} />
      {state && !state.ok ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
      >
        {label}
      </button>
    </form>
  );
}

function SimpleObAction({
  householdId,
  entryId,
  action,
  label,
}: {
  householdId: string;
  entryId: string;
  action: (
    prev: import("@/app/actions/auth").ActionResult | null,
    formData: FormData,
  ) => Promise<import("@/app/actions/auth").ActionResult>;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="entryId" value={entryId} />
      {state && !state.ok ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-semibold"
      >
        {label}
      </button>
    </form>
  );
}
