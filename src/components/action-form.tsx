"use client";

import Link from "next/link";
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
