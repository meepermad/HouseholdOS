"use client";

import { useActionState, useState, useTransition } from "react";
import type { ActionResult } from "@/app/actions/auth";
import {
  inviteMemberAction,
  regenerateInviteAction,
  revokeInviteAction,
} from "@/app/actions/household";

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

function isLocalhostInviteUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(url);
  }
}

export function InviteForm({ householdId }: { householdId: string }) {
  const [state, action, pending] = useActionState(
    inviteMemberAction,
    null as ActionResult | null,
  );
  const [mgmtPending, startMgmt] = useTransition();
  const [mgmtState, setMgmtState] = useState<ActionResult | null>(null);

  const active = mgmtState ?? state;
  const inviteUrl = active?.ok ? active.data?.inviteUrl : undefined;
  const invitationId = active?.ok ? active.data?.invitationId : undefined;
  const deliveryFailed =
    active?.ok &&
    (active.data?.deliveryStatus === "failed" ||
      active.data?.deliveryStatus === "existing_account");
  const originMisconfigured =
    Boolean(
      active &&
        !active.ok &&
        /APP_URL|not configured for production/i.test(active.error),
    ) || (active?.ok === true && isLocalhostInviteUrl(inviteUrl));

  function runRevoke() {
    if (!invitationId) return;
    const fd = new FormData();
    fd.set("householdId", householdId);
    fd.set("invitationId", invitationId);
    startMgmt(async () => {
      const result = await revokeInviteAction(null, fd);
      setMgmtState(result);
    });
  }

  function runRegenerate() {
    if (!invitationId) return;
    const fd = new FormData();
    fd.set("householdId", householdId);
    fd.set("invitationId", invitationId);
    startMgmt(async () => {
      const result = await regenerateInviteAction(null, fd);
      setMgmtState(result);
    });
  }

  return (
    <form
      action={action}
      onSubmit={() => setMgmtState(null)}
      className="space-y-3 rounded-md border border-border bg-surface p-4"
    >
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
        disabled={pending || mgmtPending}
        aria-busy={pending || mgmtPending || undefined}
        className="min-h-11 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Creating invitation…" : "Create invitation"}
      </button>
      {pending || mgmtPending ? (
        <p className="text-sm text-text-muted" aria-live="polite" role="status">
          {pending ? "Creating invitation…" : "Updating invitation…"}
        </p>
      ) : null}
      {active && !active.ok ? (
        <p className="text-sm text-destructive" role="alert">
          {active.error}
        </p>
      ) : null}
      {originMisconfigured && active?.ok ? (
        <p className="text-sm text-destructive" role="alert">
          Invitation links are not configured for production. Set APP_URL and redeploy.
        </p>
      ) : null}
      {active?.ok && inviteUrl && !isLocalhostInviteUrl(inviteUrl) ? (
        <div className="space-y-3" role="status" data-testid="invite-success">
          <p className="text-sm text-success">{active.message}</p>
          {active.warning ? (
            <p className="text-sm text-amber-800" role="status">
              {active.warning}
            </p>
          ) : null}
          <dl className="grid gap-1 text-sm text-text-secondary">
            <div>
              <dt className="inline font-medium text-text-primary">Invited email: </dt>
              <dd className="inline">{active.data?.invitedEmail}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-text-primary">Household: </dt>
              <dd className="inline">{active.data?.householdName}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-text-primary">Roles: </dt>
              <dd className="inline">{active.data?.intendedRoles}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-text-primary">Expires: </dt>
              <dd className="inline">
                {active.data?.expiresAt
                  ? new Date(active.data.expiresAt).toLocaleString()
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="inline font-medium text-text-primary">Delivery: </dt>
              <dd className="inline">{deliveryLabel(active.data?.deliveryStatus)}</dd>
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
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={mgmtPending || !invitationId}
              onClick={runRevoke}
              className="text-sm text-destructive underline disabled:opacity-60"
            >
              Revoke
            </button>
            <button
              type="button"
              disabled={mgmtPending || !invitationId}
              onClick={runRegenerate}
              className="text-sm underline disabled:opacity-60"
            >
              Regenerate invitation
            </button>
          </div>
          <p className="text-xs text-text-muted">
            The household stays usable without email delivery — share this link in your group chat.
            Tokens appear only at create or regenerate time; revoke if a link was exposed.
          </p>
        </div>
      ) : null}
      {active?.ok && active.data?.status === "revoked" ? (
        <p className="text-sm text-text-secondary" role="status">
          {active.message ?? "Invitation revoked. It can no longer be accepted."}
        </p>
      ) : null}
    </form>
  );
}
