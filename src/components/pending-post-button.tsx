"use client";

import { useState, type ReactNode } from "react";

/** Pending feedback for native POST forms (logout / clear-household). */
export function PendingPostButton({
  action,
  children,
  pendingLabel,
  className,
  method = "post",
  hiddenFields,
}: {
  action: string;
  children: ReactNode;
  pendingLabel: string;
  className?: string;
  method?: "post" | "get";
  hiddenFields?: Record<string, string>;
}) {
  const [pending, setPending] = useState(false);

  return (
    <form
      action={action}
      method={method}
      className="contents"
      onSubmit={() => setPending(true)}
    >
      {hiddenFields
        ? Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))
        : null}
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending || undefined}
        className={className}
      >
        {pending ? pendingLabel : children}
      </button>
    </form>
  );
}
