import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  markNotificationReadAction,
  markNotificationUnreadAction,
} from "@/app/actions/notifications";
import type { UserNotificationRow } from "@/lib/notifications/queries";
import { formatNotificationCategory } from "@/lib/presentation";

function formatAbsolute(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatRelative(iso: string, now: Date) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return formatAbsolute(iso);
  const diffMinutes = Math.round((now.getTime() - then) / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const hours = Math.round(diffMinutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days <= 7) return `${days}d ago`;
  return formatAbsolute(iso);
}

export function NotificationCard({
  notification,
  householdId,
}: {
  notification: UserNotificationRow;
  householdId: string;
}) {
  const unread = notification.readAt == null;
  const needsAction = notification.actionOriented && unread;
  const householdLabel =
    notification.householdName ??
    (notification.householdId ? "Unavailable" : null);
  const now = new Date();

  return (
    <li
      className={`rounded-md border px-4 py-3.5 ${
        needsAction
          ? "border-primary/40 bg-surface-elevated"
          : unread
            ? "border-border bg-surface-elevated"
            : "border-border bg-surface"
      }`}
      data-testid="notification-card"
    >
      <div className="space-y-1.5">
        {/* Where: household and topic */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
          {unread ? (
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full bg-primary"
              aria-hidden
            />
          ) : null}
          {householdLabel ? <span>{householdLabel}</span> : null}
          {householdLabel && notification.category ? <span>·</span> : null}
          {notification.category ? (
            <span>{formatNotificationCategory(notification.category)}</span>
          ) : null}
          <span
            className={`rounded-full px-2 py-0.5 font-semibold uppercase tracking-wide ${
              needsAction
                ? "bg-primary/10 text-primary"
                : "bg-surface-interactive text-text-muted"
            }`}
            data-testid="notification-kind-badge"
          >
            {needsAction ? "Needs action" : "Update"}
          </span>
        </div>

        {/* What happened */}
        <p className="font-medium text-text-primary">{notification.title}</p>
        {notification.body ? (
          <p className="text-sm text-text-secondary">{notification.body}</p>
        ) : null}

        {/* Who and when */}
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-text-muted">
          {notification.actorName ? (
            <span data-testid="notification-actor">
              {notification.actorName}
            </span>
          ) : null}
          {notification.actorName ? <span>·</span> : null}
          <time
            dateTime={notification.createdAt}
            title={formatAbsolute(notification.createdAt)}
          >
            {formatRelative(notification.createdAt, now)}
          </time>
        </p>

        {/* What to do about it */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {notification.actionHref ? (
            <Link
              href={notification.actionHref}
              className={`inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold ${
                needsAction
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-surface text-text-primary hover:bg-surface-interactive"
              }`}
              data-testid="notification-cta"
            >
              {needsAction ? "Review" : "Open"}
            </Link>
          ) : null}
          <ActionForm
            action={
              unread ? markNotificationReadAction : markNotificationUnreadAction
            }
          >
            <input type="hidden" name="householdId" value={householdId} />
            <input
              type="hidden"
              name="notificationId"
              value={notification.id}
            />
            <SubmitButton
              variant="secondary"
              pendingLabel="Saving…"
              className="text-xs"
            >
              {unread ? "Mark read" : "Mark unread"}
            </SubmitButton>
          </ActionForm>
        </div>
      </div>
    </li>
  );
}
