"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/app/actions/household";

type Props = {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
};

export function ActionForm({ action, children, className }: Props) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className={className}>
      {children}
      {state && !state.ok ? (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      {state && state.ok && state.message ? (
        <p className="mt-2 text-sm text-emerald-800" role="status">
          {state.message}
        </p>
      ) : null}
      {state && state.ok && state.data?.inviteUrl ? (
        <p className="mt-2 break-all text-sm text-slate-700">
          Invite link:{" "}
          <a className="underline" href={state.data.inviteUrl}>
            {state.data.inviteUrl}
          </a>
        </p>
      ) : null}
      {pending ? <p className="mt-2 text-xs text-slate-500">Working…</p> : null}
    </form>
  );
}
