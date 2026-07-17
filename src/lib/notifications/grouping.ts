/**
 * Group related inbox notifications into a single card (e.g. multiple supply alerts).
 */

export type GroupableNotification = {
  id: string;
  eventType: string;
  category: string;
  createdAt: string;
  title: string;
  body: string;
  readAt: string | null;
};

export type NotificationGroup = {
  key: string;
  representative: GroupableNotification;
  members: GroupableNotification[];
  count: number;
};

function groupKey(n: GroupableNotification): string {
  if (n.eventType.startsWith("shopping.") || n.eventType.startsWith("supply.") || n.eventType.startsWith("pantry.")) {
    return `supplies:${n.category}`;
  }
  if (n.eventType.startsWith("chore.")) {
    return `chores:${n.eventType}`;
  }
  if (n.eventType.startsWith("settlement.")) {
    return `settlement:${n.eventType}`;
  }
  return `single:${n.id}`;
}

export function groupNotifications(
  items: readonly GroupableNotification[],
  options?: { maxAgeMs?: number },
): NotificationGroup[] {
  const maxAge = options?.maxAgeMs ?? 24 * 60 * 60 * 1000;
  const now = Date.now();
  const buckets = new Map<string, GroupableNotification[]>();

  for (const item of items) {
    const age = now - new Date(item.createdAt).getTime();
    const key = age > maxAge ? `single:${item.id}` : groupKey(item);
    const list = buckets.get(key) ?? [];
    list.push(item);
    buckets.set(key, list);
  }

  const groups: NotificationGroup[] = [];
  for (const [key, members] of buckets) {
    const sorted = [...members].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    const representative = sorted[0]!;
    groups.push({
      key,
      representative:
        sorted.length === 1
          ? representative
          : {
              ...representative,
              title: `${sorted.length} updates · ${representative.title}`,
              body: `Including ${sorted.length} related notifications. Open the inbox for details.`,
            },
      members: sorted,
      count: sorted.length,
    });
  }

  return groups.sort((a, b) =>
    b.representative.createdAt.localeCompare(a.representative.createdAt),
  );
}

/** Prefer the newer event; older ids are candidates to supersede/hide. */
export function supersedeNotificationIds(
  newerId: string,
  olderIds: readonly string[],
): string[] {
  return olderIds.filter((id) => id !== newerId);
}
