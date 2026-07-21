"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/app/actions/auth";
import { inviteMemberAction } from "@/app/actions/household";

function deliveryLabel(status: string | undefined): string {
  switch (status) {
    case "sent":
      return "Email sent";
    case "existing_account":
      return "Existing account — share join link";
    case "failed":
      return "Email not delivered — share join link";
    case "not_attempted":
      return "Email not attempted";
    default:
      return status ?? "Unknown";
  }
}

export function InviteForm({ householdId }: { householdId: string }) {
  const [state, action, pending] = useActionState(inviteMemberAction, null as ActionResult | null);
  const inviteUrl = state?.ok ? state.data?.inviteUrl : undefined;
  const deliveryFailed =
    state?.ok &&
    (state.data?.deliveryStatus === "failed" ||
      state.data?.deliveryStatus === "existing_account");

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
        {pending ? "Creating invitation…" : "Create invitation"}
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
      {state?.ok && inviteUrl ? (
        <div className="space-y-3" role="status" data-testid="invite-success">
          <p className="text-sm text-success">{state.message}</p>
          {state.warning ? (
            <p className="text-sm text-amber-800" role="status">
              {state.warning}
            </p>
          ) : null}
          <dl className="grid gap-1 text-sm text-text-secondary">
            <div>
              <dt className="inline font-medium text-text-primary">Invited email: </dt>
              <dd className="inline">{state.data?.invitedEmail}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-text-primary">Household: </dt>
              <dd className="inline">{state.data?.householdName}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-text-primary">Roles: </dt>
              <dd className="inline">{state.data?.intendedRoles}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-text-primary">Expires: </dt>
              <dd className="inline">
                {state.data?.expiresAt
                  ? new Date(state.data.expiresAt).toLocaleString()
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="inline font-medium text-text-primary">Delivery: </dt>
              <dd className="inline">{deliveryLabel(state.data?.deliveryStatus)}</dd>
            </div>
          </dl>
          <label className="block text-sm">
            {deliveryFailed ? (
              <span className="font-semibold text-text-primary">
                Copy invitation link (primary recovery)
              </span>
            ) : (
              "Copy invitation link"
            )}
            <input
              readOnly
              value={inviteUrl}
              data-testid="invite-url"
              className={`mt-1 w-full rounded-md border px-3 py-2 text-xs ${
                deliveryFailed
                  ? "border-amber-600 bg-amber-50"
                  : "border-line bg-input-bg"
              }`}
              onFocus={(e) => e.currentTarget.select()}
            />
          </label>
          <p className="text-xs text-text-muted">
            The household stays usable without email delivery — share this link in your group chat.
          </p>
        </div>
      ) : null}
    </form>
  );
}
