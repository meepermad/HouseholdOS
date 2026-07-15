"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  primaryNavItems,
  sidebarNavItems,
  type HouseholdNavItem,
} from "@/lib/nav-items";

function linkClass(active: boolean, compact: boolean) {
  const base = compact
    ? "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-[0.65rem] font-medium leading-tight"
    : "flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium";
  return active
    ? `${base} bg-surface-interactive text-primary`
    : `${base} text-text-secondary hover:bg-surface-interactive hover:text-text-primary`;
}

function NavLinks({
  items,
  householdId,
  pathname,
  compact,
}: {
  items: HouseholdNavItem[];
  householdId: string;
  pathname: string;
  compact: boolean;
}) {
  return (
    <>
      {items.map((item) => {
        const active = item.match(pathname, householdId);
        const label = compact ? (item.shortLabel ?? item.label) : item.label;
        return (
          <Link
            key={item.key}
            href={item.href(householdId)}
            className={linkClass(active, compact)}
            aria-current={active ? "page" : undefined}
          >
            {compact ? (
              <>
                <span aria-hidden className="text-base leading-none">
                  {item.mark}
                </span>
                <span>{label}</span>
              </>
            ) : (
              <>
                <span aria-hidden className="w-4 text-center text-text-muted">
                  {item.mark}
                </span>
                <span>{label}</span>
              </>
            )}
          </Link>
        );
      })}
    </>
  );
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
    const items = primaryNavItems();
    return (
      <nav
        aria-label="Primary"
        className="app-bottom-nav safe-pb fixed inset-x-0 bottom-0 z-20 border-t border-border bg-navigation lg:hidden"
        data-testid="mobile-bottom-nav"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around gap-0.5 px-1 pt-1">
          <NavLinks
            items={items}
            householdId={householdId}
            pathname={pathname}
            compact
          />
        </div>
      </nav>
    );
  }

  if (variant === "sidebar") {
    const items = sidebarNavItems();
    return (
      <nav
        aria-label="Primary"
        className="flex flex-col gap-1 p-3"
        data-testid="desktop-sidebar-nav"
      >
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
          Navigate
        </p>
        <NavLinks
          items={items}
          householdId={householdId}
          pathname={pathname}
          compact={false}
        />
      </nav>
    );
  }

  const items = primaryNavItems();
  return (
    <nav
      aria-label="Primary"
      className="hidden gap-1 overflow-x-auto border-b border-border px-2 py-2 text-sm md:flex lg:hidden"
    >
      <NavLinks
        items={items}
        householdId={householdId}
        pathname={pathname}
        compact={false}
      />
    </nav>
  );
}
