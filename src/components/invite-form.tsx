"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/app/actions/auth";
import { inviteMemberAction } from "@/app/actions/household";

export function InviteForm({ householdId }: { householdId: string }) {
  const [state, action, pending] = useActionState(inviteMemberAction, null as ActionResult | null);

  return (
    <form action={action} className="space-y-3 rounded-md border border-border bg-surface p-4">
      <h3 className="font-semibold text-text-primary">Invite roommate</h3>
      <input type="hidden" name="householdId" value={householdId} />
      <label className="block text-sm text-text-primary">
        Email
        <input
          name="email"
          type="email"
          required
          className="mt-1 min-h-11 w-full rounded-md border border-border bg-input-bg px-3 py-2"
        />
      </label>
      <fieldset className="text-sm">
        <legend className="mb-1">Intended responsibilities</legend>
        <label className="mr-3 inline-flex items-center gap-1">
          <input type="checkbox" name="roles" value="member" defaultChecked />
          Member
        </label>
        <label className="mr-3 inline-flex items-center gap-1">
          <input type="checkbox" name="roles" value="household_coordinator" />
          Household coordinator
        </label>
        <label className="inline-flex items-center gap-1">
          <input type="checkbox" name="roles" value="financial_coordinator" />
          Financial coordinator
        </label>
      </fieldset>
      <label className="block text-sm">
        Message (optional)
        <textarea
          name="message"
          rows={2}
          className="mt-1 w-full rounded-md border border-line px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending || undefined}
        className="min-h-11 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Creating invitation…" : "Create invite link"}
      </button>
      {pending ? (
        <p className="text-sm text-text-muted" aria-live="polite" role="status">
          Creating invitation…
        </p>
      ) : null}
      {state && !state.ok ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      {state?.ok && state.data?.inviteUrl ? (
        <div className="space-y-2" role="status">
          <p className="text-sm text-success">{state.message}</p>
          <label className="block text-sm">
            Copyable link
            <input
              readOnly
              value={state.data.inviteUrl}
              className="mt-1 w-full rounded-md border border-line px-3 py-2 text-xs"
              onFocus={(e) => e.currentTarget.select()}
            />
          </label>
        </div>
      ) : null}
    </form>
  );
}
