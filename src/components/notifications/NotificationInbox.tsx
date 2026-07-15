import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { NotificationCard } from "@/components/notifications/NotificationCard";
import { markAllNotificationsReadAction } from "@/app/actions/notifications";
import type { UserNotificationRow } from "@/lib/notifications/queries";
import { PREFERENCE_CATEGORIES } from "@/lib/notifications/queries";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
] as const;

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
  const base = `/app/${householdId}/notifications`;

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

  return (
    <div className="space-y-4" data-testid="notification-inbox">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <ActionForm action={markAllNotificationsReadAction}>
          <input type="hidden" name="householdId" value={householdId} />
          <SubmitButton variant="secondary" pendingLabel="Marking…">
            Mark all read
          </SubmitButton>
        </ActionForm>
      </div>

      <div className="flex flex-wrap gap-1" aria-label="Category filter">
        <Link
          href={hrefFor({ category: "all", offset: 0 })}
          className={`inline-flex min-h-11 items-center rounded-md px-3 text-sm ${
            category === "all"
              ? "bg-surface-interactive text-primary font-medium"
              : "text-text-secondary hover:bg-surface-interactive"
          }`}
        >
          Any category
        </Link>
        {PREFERENCE_CATEGORIES.map((c) => {
          const active = category === c;
          return (
            <Link
              key={c}
              href={hrefFor({ category: c, offset: 0 })}
              className={`inline-flex min-h-11 items-center rounded-md px-3 text-sm capitalize ${
                active
                  ? "bg-surface-interactive text-primary font-medium"
                  : "text-text-secondary hover:bg-surface-interactive"
              }`}
            >
              {c}
            </Link>
          );
        })}
      </div>

      {notifications.length === 0 ? (
        <p className="rounded-md border border-border bg-surface px-4 py-8 text-center text-sm text-text-muted">
          No notifications{filter === "unread" ? " unread" : ""}.
        </p>
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => (
            <NotificationCard
              key={n.id}
              notification={n}
              householdId={householdId}
            />
          ))}
        </ul>
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
    </div>
  );
}
