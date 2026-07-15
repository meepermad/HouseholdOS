export type BadgeNotification = {
  read_at: string | null;
  action_oriented?: boolean;
};

/**
 * Unread badge count. When any item carries `action_oriented`, count only
 * unread actionable rows; otherwise count all unread.
 */
export function unreadBadgeCount(notifications: BadgeNotification[]): number {
  const unread = notifications.filter((n) => n.read_at == null);
  const useActionable = notifications.some(
    (n) => n.action_oriented !== undefined,
  );
  if (useActionable) {
    return unread.filter((n) => n.action_oriented === true).length;
  }
  return unread.length;
}

export function shouldClearBadge(count: number): boolean {
  return count <= 0;
}
