"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import {
  moreNavItems,
  primaryNavItems,
  sidebarNavItems,
  type HouseholdNavItem,
} from "@/lib/nav-items";
import { NotificationBadge } from "@/components/notifications/NotificationBadge";

function linkClass(active: boolean, compact: boolean) {
  const base = compact
    ? "relative flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-[0.65rem] font-medium leading-tight"
    : "relative flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium";
  return active
    ? `${base} bg-surface-interactive text-primary`
    : `${base} text-text-secondary hover:bg-surface-interactive hover:text-text-primary`;
}

function NavLinks({
  items,
  householdId,
  pathname,
  compact,
  unreadCount = 0,
  onNavigate,
}: {
  items: HouseholdNavItem[];
  householdId: string;
  pathname: string;
  compact: boolean;
  unreadCount?: number;
  onNavigate?: () => void;
}) {
  return (
    <>
      {items.map((item) => {
        const active = item.match(pathname, householdId);
        const label = compact ? (item.shortLabel ?? item.label) : item.label;
        const showBadge = item.key === "inbox" && unreadCount > 0;
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
                <span aria-hidden className="relative text-base leading-none">
                  {item.mark}
                  {showBadge ? (
                    <NotificationBadge
                      count={unreadCount}
                      className="absolute -right-3 -top-2"
                    />
                  ) : null}
                </span>
                <span>{label}</span>
              </>
            ) : (
              <>
                <span aria-hidden className="w-4 text-center text-text-muted">
                  {item.mark}
                </span>
                <span className="flex-1">{label}</span>
                {showBadge ? <NotificationBadge count={unreadCount} /> : null}
              </>
            )}
          </Link>
        );
      })}
    </>
  );
}

function MoreSheet({
  open,
  onClose,
  householdId,
  pathname,
  unreadCount,
  titleId,
}: {
  open: boolean;
  onClose: () => void;
  householdId: string;
  pathname: string;
  unreadCount: number;
  titleId: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const items = moreNavItems();
  return (
    <div className="fixed inset-0 z-40 lg:hidden" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close more navigation"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-x-0 bottom-0 rounded-t-lg border border-border bg-surface-elevated p-4 shadow-lg safe-pb"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border-strong" aria-hidden />
        <h2 id={titleId} className="mb-3 text-sm font-semibold text-text-primary">
          More
        </h2>
        <nav aria-label="More" className="flex flex-col gap-1">
          <NavLinks
            items={items}
            householdId={householdId}
            pathname={pathname}
            compact={false}
            unreadCount={unreadCount}
            onNavigate={onClose}
          />
        </nav>
      </div>
    </div>
  );
}

export function HouseholdNav({
  householdId,
  variant = "top",
  unreadCount = 0,
}: {
  householdId: string;
  variant?: "top" | "bottom" | "sidebar";
  unreadCount?: number;
}) {
  const pathname = usePathname() ?? "";
  const [moreOpen, setMoreOpen] = useState(false);
  const moreTitleId = useId();

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  if (variant === "bottom") {
    const items = primaryNavItems();
    const moreItems = moreNavItems();
    const moreActive = moreItems.some((item) => item.match(pathname, householdId));
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
              unreadCount={unreadCount}
            />
            <button
              type="button"
              className={linkClass(moreActive || moreOpen, true)}
              aria-expanded={moreOpen}
              aria-controls="more-nav-sheet"
              data-testid="mobile-more-nav"
              onClick={() => setMoreOpen((open) => !open)}
            >
              <span aria-hidden className="text-base leading-none">
                ···
              </span>
              <span>More</span>
            </button>
          </div>
        </nav>
        <div id="more-nav-sheet">
          <MoreSheet
            open={moreOpen}
            onClose={() => setMoreOpen(false)}
            householdId={householdId}
            pathname={pathname}
            unreadCount={unreadCount}
            titleId={moreTitleId}
          />
        </div>
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
          unreadCount={unreadCount}
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
        unreadCount={unreadCount}
      />
    </nav>
  );
}
