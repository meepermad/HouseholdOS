import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "destructive" | "ghost";

const variantClass: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-60",
  secondary:
    "border border-border bg-secondary text-secondary-foreground hover:bg-surface-interactive disabled:opacity-60",
  destructive:
    "bg-destructive text-destructive-foreground hover:opacity-90 disabled:opacity-60",
  ghost:
    "text-text-secondary underline-offset-2 hover:underline disabled:opacity-60",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${variantClass[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
