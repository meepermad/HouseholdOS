"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  {
    key: "home",
    label: "Home",
    href: (id: string) => `/app/${id}`,
    match: (pathname: string, id: string) =>
      pathname === `/app/${id}` || pathname === `/app/${id}/`,
  },
  {
    key: "money",
    label: "Money",
    href: (id: string) => `/app/${id}/money`,
    match: (pathname: string, id: string) =>
      pathname.startsWith(`/app/${id}/money`),
  },
  {
    key: "settings",
    label: "Settings",
    href: (id: string) => `/app/${id}/settings/profile`,
    match: (pathname: string, id: string) =>
      pathname.startsWith(`/app/${id}/settings`),
  },
] as const;

function navClass(active: boolean, compact: boolean) {
  const base = compact
    ? "flex min-h-11 min-w-[4.5rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-2 py-2 text-xs font-medium"
    : "flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-medium";
  return active
    ? `${base} bg-surface-interactive text-primary`
    : `${base} text-text-secondary hover:bg-surface-interactive hover:text-text-primary`;
}

export function HouseholdNav({
  householdId,
  variant = "top",
}: {
  householdId: string;
  variant?: "top" | "bottom" | "sidebar";
}) {
  const pathname = usePathname() ?? "";

  if (variant === "bottom") {
    return (
      <nav
        aria-label="Primary"
        className="safe-pb fixed inset-x-0 bottom-0 z-20 border-t border-border bg-navigation lg:hidden"
        data-testid="mobile-bottom-nav"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pt-1">
          {ITEMS.map((item) => {
            const active = item.match(pathname, householdId);
            return (
              <Link
                key={item.key}
                href={item.href(householdId)}
                className={navClass(active, true)}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  if (variant === "sidebar") {
    return (
      <nav aria-label="Primary" className="flex flex-col gap-1 p-3" data-testid="desktop-sidebar-nav">
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
          Navigate
        </p>
        {ITEMS.map((item) => {
          const active = item.match(pathname, householdId);
          return (
            <Link
              key={item.key}
              href={item.href(householdId)}
              className={navClass(active, false)}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Primary"
      className="hidden gap-1 overflow-x-auto border-b border-border px-2 py-2 text-sm md:flex lg:hidden"
    >
      {ITEMS.map((item) => {
        const active = item.match(pathname, householdId);
        return (
          <Link
            key={item.key}
            href={item.href(householdId)}
            className={navClass(active, false)}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
