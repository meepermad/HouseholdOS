"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import type { ActionResult } from "@/app/actions/auth";

type Action = (
  prev: ActionResult | null,
  formData: FormData,
) => Promise<ActionResult>;

function redirectTarget(state: ActionResult | null): string | null {
  if (!state?.ok || !state.data) return null;
  const target = state.data.redirectTo;
  return typeof target === "string" && target.startsWith("/") ? target : null;
}

export function ActionForm({
  action,
  children,
  className,
  pendingLabel = "Working…",
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  successRedirect?: string;
  pendingLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const hardRedirect = redirectTarget(state);

  useEffect(() => {
    if (!hardRedirect) return;
    // Full document navigation after auth — avoids App Router soft-nav hangs
    // that leave “Signing in…” / loading.tsx stuck after a successful 200.
    window.location.assign(hardRedirect);
  }, [hardRedirect]);

  return (
    <form action={formAction} className={className} noValidate>
      <fieldset disabled={pending || Boolean(hardRedirect)} className="contents">
        {children}
      </fieldset>
      {state && !state.ok ? (
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
