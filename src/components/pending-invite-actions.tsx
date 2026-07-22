"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/app/actions/auth";
import {
  regenerateInviteAction,
  retryInviteDeliveryAction,
  revokeInviteAction,
} from "@/app/actions/household";

function isLocalhostInviteUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(url);
  }
}

export function PendingInviteActions({
  householdId,
  invitationId,
  canRetry,
}: {
  householdId: string;
  invitationId: string;
  canRetry: boolean;
}) {
  const [regenState, regenAction, regenPending] = useActionState(
    regenerateInviteAction,
    null as ActionResult | null,
  );
  const [revokeState, revokeAction, revokePending] = useActionState(
    revokeInviteAction,
    null as ActionResult | null,
  );
  const [retryState, retryAction, retryPending] = useActionState(
    retryInviteDeliveryAction,
    null as ActionResult | null,
  );

  const pending = regenPending || revokePending || retryPending;
  const inviteUrl = regenState?.ok ? regenState.data?.inviteUrl : undefined;
  const showUrl = Boolean(inviteUrl && !isLocalhostInviteUrl(inviteUrl));
  const error =
    (regenState && !regenState.ok && regenState.error) ||
    (revokeState && !revokeState.ok && revokeState.error) ||
    (retryState && !retryState.ok && retryState.error) ||
    null;
  const revoked = revokeState?.ok === true;
  const successMessage =
    (regenState?.ok && regenState.message) ||
    (revokeState?.ok && revokeState.message) ||
    (retryState?.ok && retryState.message) ||
    null;

  if (revoked) {
    return (
      <p className="text-sm text-text-secondary" role="status">
        Invitation revoked. It can no longer be accepted.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        {canRetry ? (
          <form action={retryAction}>
            <input type="hidden" name="householdId" value={householdId} />
            <input type="hidden" name="invitationId" value={invitationId} />
            <button type="submit" disabled={pending} className="text-sm underline disabled:opacity-60">
              Retry email
            </button>
          </form>
        ) : null}
        <form action={regenAction}>
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="invitationId" value={invitationId} />
          <button type="submit" disabled={pending} className="text-sm underline disabled:opacity-60">
            Regenerate invitation
          </button>
        </form>
        <form action={revokeAction}>
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="invitationId" value={invitationId} />
          <button
            type="submit"
            disabled={pending}
            className="text-destructive underline disabled:opacity-60"
          >
            Revoke
          </button>
        </form>
      </div>
      {pending ? (
        <p className="text-sm text-text-muted" aria-live="polite" role="status">
          Updating invitation…
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {successMessage && !showUrl ? (
        <p className="text-sm text-success" role="status">
          {successMessage}
        </p>
      ) : null}
      {showUrl ? (
        <div className="space-y-1" role="status" data-testid="regenerated-invite-url">
          <p className="text-sm text-success">{successMessage}</p>
          <label className="block text-sm">
            Copy invitation link
            <input
              readOnly
              value={inviteUrl}
              className="mt-1 w-full rounded-md border border-line bg-input-bg px-3 py-2 text-xs"
              onFocus={(e) => e.currentTarget.select()}
            />
          </label>
        </div>
      ) : null}
      {regenState?.ok && isLocalhostInviteUrl(inviteUrl) ? (
        <p className="text-sm text-destructive" role="alert">
          Invitation links are not configured for production. Set APP_URL and redeploy.
        </p>
      ) : null}
    </div>
  );
}
