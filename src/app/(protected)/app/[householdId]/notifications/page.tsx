import { NotificationInbox } from "@/components/notifications/NotificationInbox";
import { assertActiveMembership } from "@/lib/household-context";
import {
  listUserNotifications,
  PREFERENCE_CATEGORIES,
  type UserNotificationRow,
} from "@/lib/notifications/queries";
import Link from "next/link";
import { logServerError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export default async function NotificationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ householdId: string }>;
  searchParams: Promise<{
    filter?: string;
    category?: string;
    offset?: string;
  }>;
}) {
  const { householdId } = await params;
  const sp = await searchParams;
  const ctx = await assertActiveMembership(householdId);

  const filter = sp.filter === "unread" ? "unread" : "all";
  const categoryRaw = (sp.category ?? "all").toLowerCase();
  const category =
    categoryRaw === "all" ||
    (PREFERENCE_CATEGORIES as readonly string[]).includes(categoryRaw)
      ? categoryRaw
      : "all";
  const offset = Math.max(Number.parseInt(sp.offset ?? "0", 10) || 0, 0);

  let rows: UserNotificationRow[] = [];
  let hasMore = false;
  try {
    const result = await listUserNotifications({
      userId: ctx.userId,
      unreadOnly: filter === "unread",
      category: category === "all" ? undefined : category,
      limit: 20,
      offset,
    });
    rows = result.rows;
    hasMore = result.hasMore;
  } catch (error) {
    logServerError("notifications_inbox", error, { householdId });
  }

  return (
    <main
      className="mx-auto max-w-2xl space-y-6"
      data-testid="notifications-inbox-page"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text-primary">
            Inbox
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Alerts across all households you can access.
          </p>
        </div>
        <Link
          href={`/app/${householdId}/settings/notifications`}
          className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-2"
        >
          Notification settings
        </Link>
      </div>

      <NotificationInbox
        householdId={householdId}
        notifications={rows}
        hasMore={hasMore}
        offset={offset}
        filter={filter}
        category={category}
      />
    </main>
  );
}
