import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function SettingsList({
  children,
  ariaLabel = "Settings",
}: {
  children: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className="overflow-hidden rounded-md border border-border bg-surface"
      data-testid="settings-list"
    >
      <ul className="divide-y divide-border">{children}</ul>
    </nav>
  );
}

export function SettingsRow({
  href,
  label,
  description,
  icon: Icon,
  value,
  testId,
}: {
  href: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  value?: string;
  testId?: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-11 items-center gap-3 px-4 py-3 text-sm text-text-primary hover:bg-surface-interactive focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus-ring"
        data-testid={testId}
      >
        {Icon ? (
          <Icon className="h-5 w-5 shrink-0 text-text-muted" aria-hidden />
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{label}</span>
          {description ? (
            <span className="mt-0.5 block text-xs text-text-muted">
              {description}
            </span>
          ) : null}
        </span>
        {value ? (
          <span className="shrink-0 text-text-muted">{value}</span>
        ) : null}
        <ChevronRight
          className="h-4 w-4 shrink-0 text-text-muted"
          aria-hidden
        />
      </Link>
    </li>
  );
}
