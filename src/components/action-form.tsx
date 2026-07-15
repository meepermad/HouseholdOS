"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/app/actions/auth";

type Action = (
  prev: ActionResult | null,
  formData: FormData,
) => Promise<ActionResult>;

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

  return (
    <form action={formAction} className={className} noValidate>
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {state && !state.ok ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      {state?.ok && state.message ? (
        <p className="text-sm text-success" role="status">
          {state.message}
        </p>
      ) : null}
      {pending ? (
        <p className="text-sm text-text-muted" aria-live="polite" role="status">
          {pendingLabel}
        </p>
      ) : null}
    </form>
  );
}
