"use client";

import { useActionState, useState, useTransition } from "react";
import type { ActionResult } from "@/app/actions/auth";
import {
  inviteCreateHouseholdRegistrationAction,
  regenerateCreateHouseholdRegistrationAction,
  revokeCreateHouseholdRegistrationAction,
} from "@/app/actions/registration-invitations";

function deliveryLabel(status: string | undefined): string {
  switch (status) {
    case "sent":
      return "Email sent";
    case "existing_account":
      return "Existing account — share registration link";
    case "failed":
      return "Email not delivered — share registration link";
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

export function CreateHouseholdInviteForm() {
  const [state, action, pending] = useActionState(
    inviteCreateHouseholdRegistrationAction,
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

  function runRevoke() {
    if (!invitationId) return;
    const fd = new FormData();
    fd.set("invitationId", invitationId);
    startMgmt(async () => {
      setMgmtState(await revokeCreateHouseholdRegistrationAction(null, fd));
    });
  }

  function runRegenerate() {
    if (!invitationId) return;
    const fd = new FormData();
    fd.set("invitationId", invitationId);
    startMgmt(async () => {
      setMgmtState(await regenerateCreateHouseholdRegistrationAction(null, fd));
    });
  }

  return (
    <form
      action={action}
      onSubmit={() => setMgmtState(null)}
      className="space-y-3 rounded-md border border-border bg-surface p-4"
      data-testid="create-household-invite-form"
    >
      <h3 className="font-semibold text-text-primary">
        Invite to create a separate household
      </h3>
      <p className="text-sm text-text-secondary">
        This invitation lets the person create an independent household. It does not add
        them to your current household.
      </p>
      <label className="block text-sm text-text-primary">
        Email
        <input
          name="email"
          type="email"
          required
          className="mt-1 min-h-11 w-full rounded-md border border-border bg-input-bg px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={pending || mgmtPending}
        aria-busy={pending || mgmtPending || undefined}
        className="min-h-11 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Creating invitation…" : "Create registration invitation"}
      </button>
      {active && !active.ok ? (
        <p className="text-sm text-destructive" role="alert">
          {active.error}
        </p>
      ) : null}
      {active?.ok && inviteUrl && !isLocalhostInviteUrl(inviteUrl) ? (
        <div className="space-y-3" role="status" data-testid="create-household-invite-success">
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
              <dt className="inline font-medium text-text-primary">Purpose: </dt>
              <dd className="inline">Create independent household</dd>
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
                Copy registration link (primary recovery)
              </span>
            ) : (
              "Copy registration link"
            )}
            <input
              readOnly
              value={inviteUrl}
              data-testid="create-household-invite-url"
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
        </div>
      ) : null}
      {active?.ok && active.data?.status === "revoked" ? (
        <p className="text-sm text-text-secondary" role="status">
          {active.message ?? "Invitation revoked."}
        </p>
      ) : null}
    </form>
  );
}
