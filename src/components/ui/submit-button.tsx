"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "destructive";
}) {
  const { pending } = useFormStatus();

  const variantClass =
    variant === "destructive"
      ? "bg-destructive text-destructive-foreground"
      : variant === "secondary"
        ? "border border-border bg-secondary text-secondary-foreground"
        : "bg-primary text-primary-foreground";

  return (
    <button
      type="submit"
      disabled={pending || props.disabled}
      aria-busy={pending || undefined}
      className={`inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60 ${variantClass} ${className}`}
      {...props}
    >
      {pending ? pendingLabel ?? "Working…" : children}
    </button>
  );
}
