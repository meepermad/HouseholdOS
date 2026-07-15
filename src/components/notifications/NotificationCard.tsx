import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  markNotificationReadAction,
  markNotificationUnreadAction,
} from "@/app/actions/notifications";
import type { UserNotificationRow } from "@/lib/notifications/queries";

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function NotificationCard({
  notification,
  householdId,
}: {
  notification: UserNotificationRow;
  householdId: string;
}) {
  const unread = notification.readAt == null;
  const householdLabel =
    notification.householdName ??
    (notification.householdId ? "Unavailable" : null);

  return (
    <li
      className={`rounded-md border border-border px-4 py-3.5 ${
        unread ? "bg-surface-elevated" : "bg-surface"
      }`}
      data-testid="notification-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {unread ? (
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full bg-primary"
                aria-hidden
              />
            ) : null}
            <p className="font-medium text-text-primary">{notification.title}</p>
          </div>
          <p className="text-sm text-text-secondary">{notification.body}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-muted">
            {householdLabel ? <span>{householdLabel}</span> : null}
            {notification.category ? (
              <span className="capitalize">{notification.category}</span>
            ) : null}
            <time dateTime={notification.createdAt}>
              {formatWhen(notification.createdAt)}
            </time>
          </div>
          {notification.actionHref ? (
            <Link
              href={notification.actionHref}
              className="mt-1 inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-2"
            >
              Open
            </Link>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          {unread ? (
            <ActionForm action={markNotificationReadAction}>
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
                Mark read
              </SubmitButton>
            </ActionForm>
          ) : (
            <ActionForm action={markNotificationUnreadAction}>
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
                Mark unread
              </SubmitButton>
            </ActionForm>
          )}
        </div>
      </div>
    </li>
  );
}
