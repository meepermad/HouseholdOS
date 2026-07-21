"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import type { ActionResult } from "@/app/actions/auth";
import {
  isDeploymentSkewError,
  reloadOnceForDeploymentSkew,
  hasExhaustedSkewReload,
} from "@/lib/deployment-skew";

type Action = (
  prev: ActionResult | null,
  formData: FormData,
) => Promise<ActionResult>;

function redirectTarget(state: ActionResult | null): string | null {
  if (!state?.ok || !state.data) return null;
  const target = state.data.redirectTo;
  return typeof target === "string" && target.startsWith("/") ? target : null;
}

function skewCopyForState(
  state: ActionResult | null,
  actionCategory: "critical" | "financial" | "ordinary" | "convenience",
): string | null {
  if (!state || state.ok) return null;
  if (!isDeploymentSkewError(state.error)) return null;
  if (actionCategory === "financial") {
    return "Your app was updated while this page was open. Reload, then review Money before submitting again — this action was not retried.";
  }
  if (hasExhaustedSkewReload()) {
    return "Your app was updated while this page was open. Reload the latest version.";
  }
  return null;
}

/**
 * Generic Server Action form helper.
 * Critical password login must use /api/auth/sign-in instead — not this component.
 */
export function ActionForm({
  action,
  children,
  className,
  pendingLabel = "Working…",
  actionCategory = "ordinary",
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  successRedirect?: string;
  pendingLabel?: string;
  /** Used for skew messaging; financial actions are never auto-retried. */
  actionCategory?: "critical" | "financial" | "ordinary" | "convenience";
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const hardRedirect = redirectTarget(state);
  const skewMessage = skewCopyForState(state, actionCategory);

  useEffect(() => {
    if (!hardRedirect) return;
    window.location.assign(hardRedirect);
  }, [hardRedirect]);

  useEffect(() => {
    if (!state || state.ok) return;
    if (!isDeploymentSkewError(state.error)) return;
    if (actionCategory === "financial") return;
    if (hasExhaustedSkewReload()) return;
    reloadOnceForDeploymentSkew();
  }, [state, actionCategory]);

  return (
    <form method="post" action={formAction} className={className} noValidate>
      <fieldset disabled={pending || Boolean(hardRedirect)} className="contents">
        {children}
      </fieldset>
      {skewMessage ? (
        <div className="space-y-2" role="alert" data-testid="action-skew-message">
          <p className="text-sm text-destructive">{skewMessage}</p>
          <button
            type="button"
            className="text-sm font-semibold text-primary underline"
            onClick={() => window.location.reload()}
          >
            Reload latest version
          </button>
        </div>
      ) : null}
      {state && !state.ok && !skewMessage ? (
        <div className="space-y-1" role="alert">
          <p className="text-sm text-destructive">{state.error}</p>
          {state.actionHref ? (
            <p className="text-sm">
              <Link
                href={state.actionHref}
                className="font-medium text-primary underline underline-offset-2"
              >
                {state.actionLabel ?? "Open related item"}
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}
      {state?.ok && state.message && !hardRedirect ? (
        <p className="text-sm text-success" role="status">
          {state.message}
        </p>
      ) : null}
      {pending || hardRedirect ? (
        <p className="text-sm text-text-muted" aria-live="polite" role="status">
          {hardRedirect ? "Opening HouseholdOS…" : pendingLabel}
        </p>
      ) : null}
    </form>
  );
}
