"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { EmptyState } from "@/components/ui/empty-state";
import { NotificationCard } from "@/components/notifications/NotificationCard";
import { markAllNotificationsReadAction } from "@/app/actions/notifications";
import type { UserNotificationRow } from "@/lib/notifications/queries";
import { INBOX_FILTER_CATEGORIES } from "@/lib/notifications/catalog";
import { formatNotificationCategory } from "@/lib/presentation";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
] as const;

function groupNotifications(notifications: UserNotificationRow[]) {
  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const startWeek = new Date(startToday);
  startWeek.setDate(startWeek.getDate() - startWeek.getDay());

  const today: UserNotificationRow[] = [];
  const thisWeek: UserNotificationRow[] = [];
  const earlier: UserNotificationRow[] = [];

  for (const n of notifications) {
    const created = new Date(n.createdAt);
    if (created >= startToday) today.push(n);
    else if (created >= startWeek) thisWeek.push(n);
    else earlier.push(n);
  }
  return { today, thisWeek, earlier };
}

export function NotificationInbox({
  householdId,
  notifications,
  hasMore,
  offset,
  filter,
  category,
}: {
  householdId: string;
  notifications: UserNotificationRow[];
  hasMore: boolean;
  offset: number;
  filter: "all" | "unread";
  category: string;
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  const base = `/app/${householdId}/notifications`;
  const groups = useMemo(
    () => groupNotifications(notifications),
    [notifications],
  );

  function hrefFor(next: {
    filter?: string;
    category?: string;
    offset?: number;
  }) {
    const params = new URLSearchParams();
    const f = next.filter ?? filter;
    const c = next.category ?? category;
    const o = next.offset ?? 0;
    if (f === "unread") params.set("filter", "unread");
    if (c && c !== "all") params.set("category", c);
    if (o > 0) params.set("offset", String(o));
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }

  function renderGroup(title: string, items: UserNotificationRow[]) {
    if (items.length === 0) return null;
    return (
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          {title}
        </h3>
        <ul className="space-y-2">
          {items.map((n) => (
            <NotificationCard
              key={n.id}
              notification={n}
              householdId={householdId}
            />
          ))}
        </ul>
      </section>
    );
  }

  return (
    <div className="space-y-4" data-testid="notification-inbox">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">
            All notifications
          </h2>
          {category !== "all" ? (
            <p className="text-xs text-text-muted">
              Filtered: {formatNotificationCategory(category)}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm font-medium"
            onClick={() => setFilterOpen(true)}
            data-testid="inbox-filter-button"
          >
            Filter
          </button>
          <ActionForm action={markAllNotificationsReadAction}>
            <input type="hidden" name="householdId" value={householdId} />
            <SubmitButton variant="secondary" pendingLabel="Marking…">
              Mark all read
            </SubmitButton>
          </ActionForm>
        </div>
      </div>

      <div
        className="flex flex-wrap gap-1"
        role="tablist"
        aria-label="Read filter"
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Link
              key={f.key}
              href={hrefFor({ filter: f.key, offset: 0 })}
              role="tab"
              aria-selected={active}
              className={`inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium ${
                active
                  ? "bg-surface-interactive text-primary"
                  : "text-text-secondary hover:bg-surface-interactive"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          variant="section"
          title={
            filter === "unread"
              ? "No unread notifications"
              : "No notifications yet"
          }
          description="Updates about payments, chores, and household activity will appear here."
          testId="inbox-empty"
        />
      ) : (
        <div className="space-y-5">
          {renderGroup("Today", groups.today)}
          {renderGroup("This week", groups.thisWeek)}
          {renderGroup("Earlier", groups.earlier)}
        </div>
      )}

      {hasMore ? (
        <div className="flex justify-center pt-2">
          <Link
            href={hrefFor({ offset: offset + notifications.length })}
            className="inline-flex min-h-11 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-text-secondary hover:bg-surface-interactive"
          >
            Load more
          </Link>
        </div>
      ) : null}

      <BottomSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filter notifications"
        testId="inbox-filter-sheet"
      >
        <nav className="flex flex-col gap-1">
          <Link
            href={hrefFor({ category: "all", offset: 0 })}
            className={`flex min-h-11 items-center rounded-md px-2 text-sm ${
              category === "all" ? "font-semibold text-primary" : ""
            }`}
            onClick={() => setFilterOpen(false)}
          >
            All categories
          </Link>
          {INBOX_FILTER_CATEGORIES.map((c) => (
            <Link
              key={c}
              href={hrefFor({ category: c, offset: 0 })}
              className={`flex min-h-11 items-center rounded-md px-2 text-sm ${
                category === c ? "font-semibold text-primary" : ""
              }`}
              onClick={() => setFilterOpen(false)}
            >
              {formatNotificationCategory(c)}
            </Link>
          ))}
        </nav>
      </BottomSheet>
    </div>
  );
}
