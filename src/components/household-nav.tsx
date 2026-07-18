"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";
import { Ellipsis } from "lucide-react";
import {
  moreNavBySection,
  primaryNavItems,
  sidebarNavItems,
  type HouseholdNavItem,
  type NavBadgeKey,
} from "@/lib/nav-items";
import { navIcon } from "@/lib/nav-icons";
import { NotificationBadge } from "@/components/notifications/NotificationBadge";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { QuickAddButton, QuickAddSheet } from "@/components/shell/quick-add-sheet";

export type NavBadgeCounts = Partial<Record<Exclude<NavBadgeKey, null>, number>>;

function linkClass(active: boolean, compact: boolean) {
  const base = compact
    ? "relative flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-[0.65rem] font-medium leading-tight"
    : "relative flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium";
  return active
    ? `${base} bg-surface-interactive text-primary`
    : `${base} text-text-secondary hover:bg-surface-interactive hover:text-text-primary`;
}

function badgeFor(
  item: HouseholdNavItem,
  counts: NavBadgeCounts,
): number {
  if (!item.badge) return 0;
  return counts[item.badge] ?? 0;
}

function NavLinks({
  items,
  householdId,
  pathname,
  compact,
  badgeCounts,
  onNavigate,
}: {
  items: HouseholdNavItem[];
  householdId: string;
  pathname: string;
  compact: boolean;
  badgeCounts: NavBadgeCounts;
  onNavigate?: () => void;
}) {
  return (
    <>
      {items.map((item) => {
        const active = item.match(pathname, householdId);
        const label = compact ? (item.shortLabel ?? item.label) : item.label;
        const count = badgeFor(item, badgeCounts);
        const Icon = navIcon(item.icon);
        return (
          <Link
            key={item.key}
            href={item.href(householdId)}
            className={linkClass(active, compact)}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
          >
            {compact ? (
              <>
                <span aria-hidden className="relative leading-none">
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
                  {count > 0 ? (
                    <NotificationBadge
                      count={count}
                      className="absolute -right-3 -top-2"
                    />
                  ) : null}
                </span>
                <span>{label}</span>
              </>
            ) : (
              <>
                <Icon
                  className="h-4 w-4 shrink-0 text-text-muted"
                  aria-hidden
                  strokeWidth={active ? 2.25 : 1.75}
                />
                <span className="flex-1">{label}</span>
                {count > 0 ? <NotificationBadge count={count} /> : null}
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
  unreadCount = 0,
  badgeCounts,
}: {
  householdId: string;
  variant?: "top" | "bottom" | "sidebar";
  unreadCount?: number;
  badgeCounts?: NavBadgeCounts;
}) {
  const pathname = usePathname() ?? "";
  const [moreOpen, setMoreOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const moreTitleId = useId();

  const counts: NavBadgeCounts = {
    ...badgeCounts,
    inbox: badgeCounts?.inbox ?? unreadCount,
  };

  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    if (moreOpen) setMoreOpen(false);
    if (quickAddOpen) setQuickAddOpen(false);
  }

  if (variant === "bottom") {
    const items = primaryNavItems();
    const sections = moreNavBySection();
    const moreActive = sections.some((group) =>
      group.items.some((item) => item.match(pathname, householdId)),
    );
    const moreBadge =
      (counts.inbox ?? 0) +
      (counts.maintenance ?? 0);

    return (
      <>
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
              badgeCounts={counts}
            />
            <button
              type="button"
              className={linkClass(moreActive || moreOpen, true)}
              aria-expanded={moreOpen}
              aria-controls={moreTitleId}
              data-testid="mobile-more-nav"
              onClick={() => setMoreOpen((open) => !open)}
            >
              <span aria-hidden className="relative leading-none">
                <Ellipsis
                  className="h-5 w-5"
                  strokeWidth={moreActive ? 2.25 : 1.75}
                />
                {moreBadge > 0 ? (
                  <NotificationBadge
                    count={moreBadge}
                    className="absolute -right-3 -top-2"
                  />
                ) : null}
              </span>
              <span>More</span>
            </button>
          </div>
        </nav>
        {/* Hide FAB on Money hub: primary actions already cover scan/add expense. */}
        {pathname === `/app/${householdId}/money` ||
        pathname === `/app/${householdId}/money/` ? null : (
          <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--app-bottom-nav-height)+var(--safe-bottom)+0.75rem)] z-20 flex justify-end px-4 lg:hidden">
            <div className="pointer-events-auto">
              <QuickAddButton onClick={() => setQuickAddOpen(true)} />
            </div>
          </div>
        )}
        <BottomSheet
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
          title="More"
          testId="more-nav-sheet"
        >
          <nav aria-label="More" className="flex flex-col gap-4">
            {sections.map((group) => (
              <div key={group.section}>
                <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {group.label}
                </p>
                <div className="flex flex-col gap-1">
                  <NavLinks
                    items={group.items}
                    householdId={householdId}
                    pathname={pathname}
                    compact={false}
                    badgeCounts={counts}
                    onNavigate={() => setMoreOpen(false)}
                  />
                </div>
              </div>
            ))}
          </nav>
        </BottomSheet>
        <QuickAddSheet
          open={quickAddOpen}
          onClose={() => setQuickAddOpen(false)}
          householdId={householdId}
        />
      </>
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
          badgeCounts={counts}
        />
        <div className="mt-4 px-3">
          <QuickAddButton onClick={() => setQuickAddOpen(true)} />
        </div>
        <QuickAddSheet
          open={quickAddOpen}
          onClose={() => setQuickAddOpen(false)}
          householdId={householdId}
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
        badgeCounts={counts}
      />
    </nav>
  );
}
