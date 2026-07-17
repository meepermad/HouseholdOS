"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Accessible progressive-disclosure section.
 * Collapsed content stays in the DOM so form fields still submit and validate.
 */
export function DisclosureSection({
  title,
  description,
  defaultOpen = false,
  children,
  testId,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  testId?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const titleId = useId();

  return (
    <div
      className="rounded-md border border-border bg-surface-secondary"
      data-testid={testId}
    >
      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left"
        aria-expanded={open}
        aria-controls={panelId}
        id={titleId}
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          <span className="block text-sm font-semibold text-text-primary">
            {title}
          </span>
          {description ? (
            <span className="mt-0.5 block text-xs text-text-muted">
              {description}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-text-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={titleId}
        hidden={!open}
        className="space-y-4 border-t border-border px-3 py-3"
      >
        {children}
      </div>
    </div>
  );
}
