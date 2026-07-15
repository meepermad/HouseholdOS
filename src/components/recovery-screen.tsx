import type { ReactNode, Ref } from "react";

/**
 * Shared escape-hatch layout for recovery, errors, unauthorized, and not-found.
 * Uses design tokens so light/dark themes match the rest of the app.
 */
export function RecoveryScreen({
  title,
  body,
  reference,
  brand = true,
  primary,
  secondary,
  footer,
  testId,
  headingRef,
}: {
  title: string;
  body: string;
  reference?: string | null;
  brand?: boolean;
  primary?: ReactNode;
  secondary?: ReactNode;
  footer?: ReactNode;
  testId?: string;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10 text-text-primary"
      data-testid={testId}
    >
      {brand ? (
        <p className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-text-primary">
          HouseholdOS
        </p>
      ) : null}

      <h1
        ref={headingRef}
        tabIndex={headingRef ? -1 : undefined}
        className={`text-xl font-semibold text-text-primary outline-none ${brand ? "mt-6" : ""}`}
      >
        {title}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-text-secondary">{body}</p>
      {reference ? (
        <p
          className="mt-3 text-xs text-text-muted"
          data-testid="error-reference"
        >
          Reference: {reference}
        </p>
      ) : null}

      {primary ? (
        <div className="mt-8 flex flex-wrap gap-3">{primary}</div>
      ) : null}

      {secondary ? (
        <div className="mt-5 flex flex-col gap-2 border-t border-border pt-5 sm:flex-row sm:flex-wrap sm:items-center">
          {secondary}
        </div>
      ) : null}

      {footer ? (
        <p className="mt-8 text-sm text-text-muted">{footer}</p>
      ) : null}
    </main>
  );
}

export const recoveryControlClass = {
  primary:
    "inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground",
  secondary:
    "inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground",
  ghost:
    "inline-flex min-h-11 items-center justify-center rounded-md px-2 py-2 text-sm font-medium text-text-secondary underline-offset-2 hover:underline",
  link: "font-medium text-primary underline-offset-2 hover:underline",
} as const;
