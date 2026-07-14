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
  successRedirect,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  successRedirect?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  if (state?.ok && successRedirect && typeof window !== "undefined") {
    // Prefer server redirects from actions; this is a client fallback for non-redirect success.
  }

  return (
    <form action={formAction} className={className} noValidate>
      {children}
      {state && !state.ok ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      {state?.ok && state.message ? (
        <p className="text-sm text-emerald-800" role="status">
          {state.message}
        </p>
      ) : null}
      {pending ? (
        <p className="text-sm text-slate-500" aria-live="polite">
          Working…
        </p>
      ) : null}
    </form>
  );
}
