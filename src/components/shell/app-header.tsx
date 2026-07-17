"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDown, UserRound } from "lucide-react";
import { switchHouseholdAction } from "@/app/actions/household";
import { ThemeSelector } from "@/components/theme-selector";
import { PendingPostButton } from "@/components/pending-post-button";
import { NotificationBadge } from "@/components/notifications/NotificationBadge";
import { BottomSheet } from "@/components/ui/bottom-sheet";

export function AppHeader({
  pageTitle,
  householdName,
  householdId,
  households,
  unreadCount = 0,
  showBrand = false,
}: {
  pageTitle?: string;
  householdName: string;
  householdId: string;
  households: { id: string; name: string }[];
  unreadCount?: number;
  /** Keep HouseholdOS wordmark on Home / splash only. */
  showBrand?: boolean;
}) {
  const router = useRouter();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function switchTo(nextId: string) {
    if (nextId === householdId) {
      setSwitcherOpen(false);
      return;
    }
    const formData = new FormData();
    formData.set("householdId", nextId);
    startTransition(async () => {
      await switchHouseholdAction(null, formData);
      setSwitcherOpen(false);
      router.push(`/app/${nextId}`);
      router.refresh();
    });
  }

  return (
    <>
      <header
        className="shell-top sticky top-0 z-30 border-b border-border bg-navigation/95 backdrop-blur safe-px"
        data-testid="app-header"
      >
        <div className="flex items-center justify-between gap-2 px-3 pb-2">
          <div className="min-w-0 flex-1">
            {showBrand ? (
              <Link
                href={`/app/${householdId}`}
                className="font-[family-name:var(--font-display)] text-base text-text-primary"
              >
                HouseholdOS
              </Link>
            ) : null}
            <button
              type="button"
              className={`flex min-h-11 max-w-full items-center gap-1 rounded-md px-1 text-left hover:bg-surface-interactive ${
                showBrand ? "mt-0.5" : ""
              }`}
              aria-expanded={switcherOpen}
              aria-haspopup="dialog"
              data-testid="household-switcher-trigger"
              onClick={() => setSwitcherOpen(true)}
            >
              <span className="truncate text-sm font-semibold text-text-primary">
                {householdName}
              </span>
              <ChevronDown
                className="h-4 w-4 shrink-0 text-text-muted"
                aria-hidden
              />
            </button>
          </div>
          <button
            type="button"
            className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border bg-surface px-3 text-sm font-medium text-text-secondary hover:bg-surface-interactive"
            aria-expanded={accountOpen}
            aria-haspopup="dialog"
            aria-label="Account"
            data-testid="user-menu-button"
            onClick={() => setAccountOpen(true)}
          >
            <UserRound className="h-5 w-5" aria-hidden />
            <span className="sr-only sm:not-sr-only sm:ml-1.5">Account</span>
            {unreadCount > 0 ? (
              <NotificationBadge
                count={unreadCount}
                className="absolute -right-1 -top-1"
              />
            ) : null}
          </button>
        </div>
        {pageTitle ? (
          <div className="px-4 pb-2">
            <h1 className="font-[family-name:var(--font-display)] text-xl text-text-primary md:text-2xl">
              {pageTitle}
            </h1>
          </div>
        ) : null}
      </header>

      <BottomSheet
        open={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        title="Switch household"
        testId="household-switcher-sheet"
      >
        <ul className="flex flex-col gap-1">
          {households.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                disabled={pending}
                className={`flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm ${
                  h.id === householdId
                    ? "bg-surface-interactive font-semibold text-primary"
                    : "text-text-secondary hover:bg-surface-interactive"
                }`}
                onClick={() => switchTo(h.id)}
              >
                {h.name}
              </button>
            </li>
          ))}
        </ul>
        {pending ? (
          <p className="mt-2 text-xs text-text-muted" aria-live="polite">
            Switching household…
          </p>
        ) : null}
      </BottomSheet>

      <BottomSheet
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        title="Account"
        testId="account-sheet"
      >
        <ThemeSelector id="header-theme" className="mb-3" />
        <div className="flex flex-col gap-1 border-t border-border pt-3">
          <Link
            href={`/app/${householdId}/notifications`}
            className="flex min-h-11 items-center justify-between rounded-md px-2 text-sm text-text-secondary hover:bg-surface-interactive"
            onClick={() => setAccountOpen(false)}
          >
            <span>Inbox</span>
            <NotificationBadge count={unreadCount} />
          </Link>
          <Link
            href={`/app/${householdId}/settings`}
            className="flex min-h-11 items-center rounded-md px-2 text-sm text-text-secondary hover:bg-surface-interactive"
            onClick={() => setAccountOpen(false)}
          >
            Settings
          </Link>
          <Link
            href={`/app/${householdId}/settings/profile`}
            className="flex min-h-11 items-center rounded-md px-2 text-sm text-text-secondary hover:bg-surface-interactive"
            onClick={() => setAccountOpen(false)}
          >
            Profile
          </Link>
          <Link
            href="/recovery"
            className="flex min-h-11 items-center rounded-md px-2 text-sm text-text-secondary hover:bg-surface-interactive"
            onClick={() => setAccountOpen(false)}
          >
            Recovery
          </Link>
          <PendingPostButton
            action="/auth/logout"
            pendingLabel="Signing out…"
            className="mt-2 min-h-11 w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
          >
            Sign out
          </PendingPostButton>
        </div>
      </BottomSheet>
    </>
  );
}
