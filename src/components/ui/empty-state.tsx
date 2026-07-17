import type { ReactNode } from "react";

export type EmptyStateVariant = "inline" | "section" | "page";

const variantClass: Record<EmptyStateVariant, string> = {
  inline: "py-2 text-sm text-text-muted",
  section:
    "rounded-md border border-border bg-surface-secondary px-3 py-4 text-center",
  page: "rounded-md border border-dashed border-border-strong bg-surface-secondary px-4 py-8 text-center",
};

export function EmptyState({
  title,
  description,
  action,
  testId,
  variant = "page",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  testId?: string;
  variant?: EmptyStateVariant;
}) {
  if (variant === "inline") {
    return (
      <p className={variantClass.inline} data-testid={testId} role="status">
        {title}
        {description ? ` ${description}` : ""}
      </p>
    );
  }

  const titleClass =
    variant === "page"
      ? "font-[family-name:var(--font-display)] text-lg text-text-primary"
      : "text-sm font-semibold text-text-primary";

  return (
    <div
      className={variantClass[variant]}
      data-testid={testId}
      role="status"
    >
      <h2 className={titleClass}>{title}</h2>
      {description ? (
        <p
          className={`mx-auto mt-1 max-w-md text-text-secondary ${
            variant === "page" ? "text-sm" : "text-xs"
          }`}
        >
          {description}
        </p>
      ) : null}
      {action ? (
        <div className="mt-3 flex flex-wrap justify-center gap-2">{action}</div>
      ) : null}
    </div>
  );
}

/** Pick empty-state density from how much context surrounds the section. */
export function selectEmptyStateVariant(options: {
  isFullPage?: boolean;
  hasSiblingContent?: boolean;
}): EmptyStateVariant {
  if (options.isFullPage) return "page";
  if (options.hasSiblingContent) return "inline";
  return "section";
}
