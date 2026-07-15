"use client";

import Link from "next/link";
import { useState } from "react";
import { ThemeSelector } from "@/components/theme-selector";
import { PendingPostButton } from "@/components/pending-post-button";

export function ShellHeader({
  title,
  householdName,
  showUserMenu = true,
}: {
  title?: string;
  householdName?: string;
  showUserMenu?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="standalone-top sticky top-0 z-30 flex items-center justify-between border-b border-border bg-navigation/95 px-4 py-3 backdrop-blur safe-px">
      <div className="min-w-0">
        <Link
          href="/app"
          className="font-[family-name:var(--font-display)] text-lg text-text-primary"
        >
          HouseholdOS
        </Link>
        {householdName ? (
          <p className="truncate text-xs text-text-muted">{householdName}</p>
        ) : null}
        {title ? <p className="sr-only">{title}</p> : null}
      </div>
      {showUserMenu ? (
        <div className="relative">
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border bg-surface px-3 text-sm font-medium text-text-secondary hover:bg-surface-interactive"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-controls="user-menu"
            onClick={() => setMenuOpen((o) => !o)}
            data-testid="user-menu-button"
          >
            Account
          </button>
          {menuOpen ? (
            <div
              id="user-menu"
              role="menu"
              className="absolute right-0 mt-2 w-72 rounded-md border border-border bg-surface-elevated p-3 shadow-lg"
            >
              <ThemeSelector id="header-theme" className="mb-3" />
              <div className="flex flex-col gap-2 border-t border-border pt-3">
                <Link
                  href="/recovery"
                  role="menuitem"
                  className="min-h-11 rounded-md px-2 py-2 text-sm text-text-secondary hover:bg-surface-interactive"
                  onClick={() => setMenuOpen(false)}
                >
                  Recovery
                </Link>
                <PendingPostButton
                  action="/auth/logout"
                  pendingLabel="Signing out…"
                  className="min-h-11 w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                >
                  Sign out
                </PendingPostButton>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <PendingPostButton
          action="/auth/logout"
          pendingLabel="Signing out…"
          className="text-sm text-text-secondary underline"
        >
          Sign out
        </PendingPostButton>
      )}
    </header>
  );
}
