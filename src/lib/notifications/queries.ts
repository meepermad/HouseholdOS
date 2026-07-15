import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { DeliveryMode, NotificationCategory } from "@/lib/notifications/catalog";
import type { PrivacyPreview } from "@/lib/notifications/templates";
import { normalizeDeepLink } from "@/lib/notifications/deep-links";

/** Untyped access until notification delivery tables land in generated types. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedDb = any;

function db(client: Awaited<ReturnType<typeof createClient>>): UntypedDb {
  return client;
}

export type UserNotificationRow = {
  id: string;
  userId: string;
  householdId: string | null;
  householdName: string | null;
  title: string;
  body: string;
  actionHref: string | null;
  category: string | null;
  urgency: string | null;
  actionOriented: boolean;
  readAt: string | null;
  createdAt: string;
};

export type PushDeviceRow = {
  id: string;
  deviceLabel: string | null;
  platformCategory: string | null;
  userAgentSummary: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  lastSuccessAt: string | null;
  failureCount: number;
  disabledReason: string | null;
  installationId: string | null;
};

export type QuietHoursRow = {
  enabled: boolean;
  startLocal: string;
  endLocal: string;
  timeZone: string;
  allowUrgentOverride: boolean;
  previewMode: PrivacyPreview;
};

export type ChannelPreferenceRow = {
  category: string;
  channel: string;
  deliveryMode: DeliveryMode;
};

const DEFAULT_QUIET: QuietHoursRow = {
  enabled: false,
  startLocal: "22:00",
  endLocal: "07:00",
  timeZone: "America/Chicago",
  allowUrgentOverride: true,
  previewMode: "generic",
};

function timeToHhMm(value: string | null | undefined): string {
  if (!value) return "00:00";
  // Postgres time may be "22:00:00" or "22:00:00.000000"
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return value.slice(0, 5);
  return `${match[1]!.padStart(2, "0")}:${match[2]}`;
}

export async function listUserNotifications(opts: {
  userId: string;
  unreadOnly?: boolean;
  category?: string;
  limit?: number;
  offset?: number;
}): Promise<{ rows: UserNotificationRow[]; hasMore: boolean }> {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  const offset = Math.max(opts.offset ?? 0, 0);
  const supabase = await createClient();

  // New columns (category, action_oriented) may not be in generated types yet.
  let query = db(supabase)
    .from("user_notifications")
    .select(
      "id, user_id, household_id, title, body, action_href, category, urgency, action_oriented, read_at, created_at",
    )
    .eq("user_id", opts.userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit);

  if (opts.unreadOnly) {
    query = query.is("read_at", null);
  }
  if (opts.category && opts.category !== "all") {
    query = query.eq("category", opts.category);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const raw = (data ?? []) as Array<{
    id: string;
    user_id: string;
    household_id: string | null;
    title: string;
    body: string;
    action_href: string | null;
    category: string | null;
    urgency: string | null;
    action_oriented: boolean | null;
    read_at: string | null;
    created_at: string;
  }>;

  const page = raw.slice(0, limit);
  const hasMore = raw.length > limit;

  const householdIds = [
    ...new Set(
      page
        .map((r) => r.household_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];

  const nameById = new Map<string, string>();
  if (householdIds.length > 0) {
    const { data: households } = await supabase
      .from("households")
      .select("id, name")
      .in("id", householdIds);
    for (const h of households ?? []) {
      nameById.set(h.id, h.name);
    }

    // Only show names for households the user still belongs to.
    const { data: memberships } = await supabase
      .from("household_memberships")
      .select("household_id")
      .eq("user_id", opts.userId)
      .eq("status", "active")
      .in("household_id", householdIds);
    const memberSet = new Set(
      (memberships ?? []).map((m) => m.household_id),
    );
    for (const id of householdIds) {
      if (!memberSet.has(id)) {
        nameById.delete(id);
      }
    }
  }

  const rows: UserNotificationRow[] = page.map((r) => {
    const householdName = r.household_id
      ? (nameById.get(r.household_id) ?? null)
      : null;
    return {
      id: r.id,
      userId: r.user_id,
      householdId: r.household_id,
      householdName,
      title: r.title,
      body: r.body,
      actionHref: r.action_href ? normalizeDeepLink(r.action_href) : null,
      category: r.category,
      urgency: r.urgency,
      actionOriented: r.action_oriented === true,
      readAt: r.read_at,
      createdAt: r.created_at,
    };
  });

  return { rows, hasMore };
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("user_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) {
    throw error;
  }
  return count ?? 0;
}

export async function listPushDevices(userId: string): Promise<PushDeviceRow[]> {
  const supabase = await createClient();
  const { data, error } = await db(supabase)
    .from("push_subscription_devices")
    .select(
      "id, device_label, platform_category, user_agent_summary, active, created_at, updated_at, last_success_at, failure_count, disabled_reason, installation_id",
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    deviceLabel: (r.device_label as string | null) ?? null,
    platformCategory: (r.platform_category as string | null) ?? null,
    userAgentSummary: (r.user_agent_summary as string | null) ?? null,
    active: r.active === true,
    createdAt: String(r.created_at ?? ""),
    updatedAt: String(r.updated_at ?? ""),
    lastSuccessAt: (r.last_success_at as string | null) ?? null,
    failureCount: Number(r.failure_count ?? 0),
    disabledReason: (r.disabled_reason as string | null) ?? null,
    installationId: (r.installation_id as string | null) ?? null,
  }));
}

export async function getQuietHours(userId: string): Promise<QuietHoursRow> {
  const supabase = await createClient();
  const { data, error } = await db(supabase)
    .from("notification_quiet_hours")
    .select(
      "enabled, start_local, end_local, time_zone, allow_urgent_override, preview_mode",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return { ...DEFAULT_QUIET };
  }

  const row = data as Record<string, unknown>;
  const preview =
    row.preview_mode === "detailed" ? "detailed" : "generic";

  return {
    enabled: row.enabled === true,
    startLocal: timeToHhMm(String(row.start_local ?? DEFAULT_QUIET.startLocal)),
    endLocal: timeToHhMm(String(row.end_local ?? DEFAULT_QUIET.endLocal)),
    timeZone: String(row.time_zone ?? DEFAULT_QUIET.timeZone),
    allowUrgentOverride:
      row.allow_urgent_override === undefined
        ? true
        : row.allow_urgent_override === true,
    previewMode: preview,
  };
}

export async function getChannelPreferences(
  userId: string,
): Promise<ChannelPreferenceRow[]> {
  const supabase = await createClient();
  const { data, error } = await db(supabase)
    .from("notification_channel_preferences")
    .select("category, channel, delivery_mode")
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    category: String(r.category),
    channel: String(r.channel),
    deliveryMode: String(r.delivery_mode) as DeliveryMode,
  }));
}

export async function getNotificationPrivacyPreview(
  userId: string,
): Promise<PrivacyPreview> {
  const quiet = await getQuietHours(userId);
  return quiet.previewMode ?? "generic";
}

/** Categories exposed in preference / filter UIs (DB-constrained set). */
export const PREFERENCE_CATEGORIES = [
  "payments",
  "disputes",
  "membership",
  "chores",
  "calendar",
  "system",
] as const satisfies readonly NotificationCategory[];
