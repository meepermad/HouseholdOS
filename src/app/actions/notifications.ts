"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import type { ActionResult } from "@/app/actions/auth";
import { logServerError } from "@/lib/errors";
import { assertActiveMembership, requireUser } from "@/lib/household-context";
import {
  hashEndpoint,
  pushSubscriptionClientSchema,
  summarizeUserAgent,
} from "@/lib/notifications/subscription";
import { PREFERENCE_CATEGORIES } from "@/lib/notifications/queries";

/** Untyped access until notification delivery RPCs land in generated types. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedDb = any;

function db(client: unknown): UntypedDb {
  return client;
}

const uuidSchema = z.string().uuid();
const hhMmSchema = z
  .string()
  .transform((v) => {
    const match = /^([01]?\d|2[0-3]):([0-5]\d)/.exec(v.trim());
    if (!match) return v.trim();
    return `${match[1]!.padStart(2, "0")}:${match[2]}`;
  })
  .pipe(z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Use HH:MM (24h)."));

const deliveryModeSchema = z.enum(["immediate", "daily_digest", "off"]);
const channelSchema = z.enum(["in_app", "push", "email"]);
const categorySchema = z.enum([
  "payments",
  "disputes",
  "membership",
  "chores",
  "calendar",
  "system",
]);
const privacyPreviewSchema = z.enum(["generic", "detailed"]);

function revalidateNotificationPaths(householdId?: string | null) {
  if (householdId) {
    revalidatePath(`/app/${householdId}`);
    revalidatePath(`/app/${householdId}/notifications`);
    revalidatePath(`/app/${householdId}/settings/notifications`);
  } else {
    revalidatePath("/app");
  }
}

export async function registerPushSubscriptionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { user } = await requireUser();
    if (!user) {
      return { ok: false, error: "Sign in to enable push notifications." };
    }

    const householdIdRaw = String(formData.get("householdId") ?? "").trim();
    const householdId = uuidSchema.safeParse(householdIdRaw).success
      ? householdIdRaw
      : null;
    if (householdId) {
      await assertActiveMembership(householdId);
    }

    const expirationRaw = formData.get("expirationTime");
    let expirationTime: number | null | undefined;
    if (expirationRaw != null && String(expirationRaw).trim() !== "") {
      const n = Number(expirationRaw);
      expirationTime = Number.isFinite(n) ? n : null;
    }

    const parsed = pushSubscriptionClientSchema.safeParse({
      endpoint: formData.get("endpoint"),
      expirationTime,
      keys: {
        p256dh: formData.get("p256dh"),
        auth: formData.get("auth"),
      },
      deviceLabel: String(formData.get("deviceLabel") ?? "").trim() || undefined,
      installationId:
        String(formData.get("installationId") ?? "").trim() || undefined,
    });

    if (!parsed.success) {
      return { ok: false, error: "Invalid push subscription." };
    }

    const headerStore = await headers();
    const ua = headerStore.get("user-agent");
    const summary = summarizeUserAgent(ua);
    const endpoint = parsed.data.endpoint.trim();
    // Ensure hash matches RPC trim behavior.
    void hashEndpoint(endpoint);

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const expirationIso =
      parsed.data.expirationTime != null
        ? new Date(parsed.data.expirationTime).toISOString()
        : null;

    const { data, error } = await db(supabase).rpc(
      "upsert_push_subscription",
      {
        p_endpoint: endpoint,
        p_p256dh: parsed.data.keys.p256dh,
        p_auth: parsed.data.keys.auth,
        p_user_agent_summary: summary.userAgentSummary,
        p_device_label: parsed.data.deviceLabel ?? null,
        p_platform_category: summary.platformCategory,
        p_installation_id: parsed.data.installationId ?? null,
        p_expiration_time: expirationIso,
      },
    );

    if (error) {
      logServerError("registerPushSubscription", error, { userId: user.id });
      return { ok: false, error: "Could not save this device subscription." };
    }

    revalidateNotificationPaths(householdId);
    return {
      ok: true,
      message: "Push notifications enabled on this device.",
      data: { subscriptionId: String(data) },
    };
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    logServerError("registerPushSubscription", e);
    return { ok: false, error: "Could not enable push notifications." };
  }
}

export async function deactivatePushSubscriptionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { user } = await requireUser();
    if (!user) {
      return { ok: false, error: "Sign in required." };
    }

    const householdIdRaw = String(formData.get("householdId") ?? "").trim();
    const householdId = uuidSchema.safeParse(householdIdRaw).success
      ? householdIdRaw
      : null;
    if (householdId) {
      await assertActiveMembership(householdId);
    }

    const parsed = z
      .object({ subscriptionId: z.string().uuid() })
      .safeParse({ subscriptionId: formData.get("subscriptionId") });
    if (!parsed.success) {
      return { ok: false, error: "Invalid subscription." };
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await db(supabase).rpc(
      "deactivate_push_subscription",
      {
        p_subscription_id: parsed.data.subscriptionId,
        p_endpoint_hash: null,
      },
    );

    if (error) {
      logServerError("deactivatePushSubscription", error, { userId: user.id });
      return { ok: false, error: "Could not remove this device." };
    }

    if (!data) {
      return { ok: false, error: "Device subscription not found." };
    }

    revalidateNotificationPaths(householdId);
    return { ok: true, message: "Device removed." };
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    logServerError("deactivatePushSubscription", e);
    return { ok: false, error: "Could not remove this device." };
  }
}

export async function deactivateCurrentEndpointAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { user } = await requireUser();
    if (!user) {
      return { ok: false, error: "Sign in required." };
    }

    const householdIdRaw = String(formData.get("householdId") ?? "").trim();
    const householdId = uuidSchema.safeParse(householdIdRaw).success
      ? householdIdRaw
      : null;
    if (householdId) {
      await assertActiveMembership(householdId);
    }

    const endpointRaw = String(formData.get("endpoint") ?? "").trim();
    const hashRaw = String(formData.get("endpointHash") ?? "")
      .trim()
      .toLowerCase();

    let endpointHash = hashRaw;
    if (!endpointHash && endpointRaw) {
      endpointHash = hashEndpoint(endpointRaw);
    }

    const parsed = z
      .object({
        endpointHash: z
          .string()
          .regex(/^[a-f0-9]{64}$/, "Invalid endpoint hash."),
      })
      .safeParse({ endpointHash });

    if (!parsed.success) {
      return { ok: false, error: "Invalid endpoint." };
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await db(supabase).rpc(
      "deactivate_push_subscription",
      {
        p_subscription_id: null,
        p_endpoint_hash: parsed.data.endpointHash,
      },
    );

    if (error) {
      logServerError("deactivateCurrentEndpoint", error, { userId: user.id });
      return { ok: false, error: "Could not deactivate this device." };
    }

    revalidateNotificationPaths(householdId);
    return {
      ok: true,
      message: data ? "This device was deactivated." : "No matching device.",
    };
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    logServerError("deactivateCurrentEndpoint", e);
    return { ok: false, error: "Could not deactivate this device." };
  }
}

export async function saveQuietHoursAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { user } = await requireUser();
    if (!user) {
      return { ok: false, error: "Sign in required." };
    }

    const householdIdRaw = String(formData.get("householdId") ?? "").trim();
    const householdId = uuidSchema.safeParse(householdIdRaw).success
      ? householdIdRaw
      : null;
    if (householdId) {
      await assertActiveMembership(householdId);
    }

    const enabledRaw = formData.get("enabled");
    const urgentRaw = formData.get("allowUrgentOverride");
    const parsed = z
      .object({
        enabled: z.boolean(),
        startLocal: hhMmSchema,
        endLocal: hhMmSchema,
        timeZone: z.string().trim().min(1).max(64),
        allowUrgentOverride: z.boolean(),
        previewMode: privacyPreviewSchema.optional(),
      })
      .safeParse({
        enabled: enabledRaw === "on" || enabledRaw === "true",
        startLocal: String(formData.get("startLocal") ?? "").trim(),
        endLocal: String(formData.get("endLocal") ?? "").trim(),
        timeZone: String(formData.get("timeZone") ?? "").trim(),
        allowUrgentOverride:
          urgentRaw === "on" || urgentRaw === "true",
        previewMode: formData.get("privacyPreview")
          ? String(formData.get("privacyPreview"))
          : undefined,
      });

    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid quiet hours.",
      };
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const row: Record<string, unknown> = {
      user_id: user.id,
      enabled: parsed.data.enabled,
      start_local: parsed.data.startLocal,
      end_local: parsed.data.endLocal,
      time_zone: parsed.data.timeZone,
      allow_urgent_override: parsed.data.allowUrgentOverride,
      updated_at: new Date().toISOString(),
    };
    if (parsed.data.previewMode) {
      row.preview_mode = parsed.data.previewMode;
    }

    const { error } = await db(supabase)
      .from("notification_quiet_hours")
      .upsert(row, { onConflict: "user_id" });

    if (error) {
      // Retry without preview_mode if column not migrated yet.
      if (parsed.data.previewMode && row.preview_mode) {
        delete row.preview_mode;
        const retry = await db(supabase)
          .from("notification_quiet_hours")
          .upsert(row, { onConflict: "user_id" });
        if (retry.error) {
          logServerError("saveQuietHours", retry.error, { userId: user.id });
          return { ok: false, error: "Could not save quiet hours." };
        }
      } else {
        logServerError("saveQuietHours", error, { userId: user.id });
        return { ok: false, error: "Could not save quiet hours." };
      }
    }

    revalidateNotificationPaths(householdId);
    return { ok: true, message: "Quiet hours saved." };
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    logServerError("saveQuietHours", e);
    return { ok: false, error: "Could not save quiet hours." };
  }
}

export async function saveNotificationPreferencesAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { user } = await requireUser();
    if (!user) {
      return { ok: false, error: "Sign in required." };
    }

    const householdIdRaw = String(formData.get("householdId") ?? "").trim();
    const householdId = uuidSchema.safeParse(householdIdRaw).success
      ? householdIdRaw
      : null;
    if (householdId) {
      await assertActiveMembership(householdId);
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    // Channel modes: mode_{category}_{channel}
    const updates: Array<{
      category: z.infer<typeof categorySchema>;
      channel: z.infer<typeof channelSchema>;
      deliveryMode: z.infer<typeof deliveryModeSchema>;
    }> = [];

    for (const category of PREFERENCE_CATEGORIES) {
      for (const channel of ["in_app", "push", "email"] as const) {
        const key = `mode_${category}_${channel}`;
        const raw = formData.get(key);
        if (raw == null || String(raw).trim() === "") continue;
        const mode = deliveryModeSchema.safeParse(String(raw));
        const cat = categorySchema.safeParse(category);
        const ch = channelSchema.safeParse(channel);
        if (!mode.success || !cat.success || !ch.success) continue;
        updates.push({
          category: cat.data,
          channel: ch.data,
          deliveryMode: mode.data,
        });
      }
    }

    for (const u of updates) {
      const { error } = await db(supabase).rpc(
        "upsert_notification_preference",
        {
          p_category: u.category,
          p_channel: u.channel,
          p_delivery_mode: u.deliveryMode,
        },
      );
      if (error) {
        logServerError("saveNotificationPreferences", error, {
          userId: user.id,
          category: u.category,
          channel: u.channel,
        });
        return {
          ok: false,
          error:
            error.message?.includes("cannot be turned off")
              ? "In-app alerts for payments and disputes stay on."
              : "Could not save notification preferences.",
        };
      }
    }

    // Quiet hours + privacy may be submitted together from the settings form.
    const hasQuiet =
      formData.has("startLocal") ||
      formData.has("enabled") ||
      formData.has("privacyPreview");
    if (hasQuiet && (formData.has("startLocal") || formData.has("privacyPreview"))) {
      const quietResult = await saveQuietHoursAction(null, formData);
      if (!quietResult.ok) return quietResult;
    } else if (formData.has("privacyPreview")) {
      const preview = privacyPreviewSchema.safeParse(
        String(formData.get("privacyPreview")),
      );
      if (preview.success) {
        const { error } = await db(supabase)
          .from("notification_quiet_hours")
          .upsert(
            {
              user_id: user.id,
              preview_mode: preview.data,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          );
        if (error) {
          // Column may not exist yet — non-fatal for prefs save.
          logServerError("savePrivacyPreview", error, { userId: user.id });
        }
      }
    }

    revalidateNotificationPaths(householdId);
    return { ok: true, message: "Notification preferences saved." };
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    logServerError("saveNotificationPreferences", e);
    return { ok: false, error: "Could not save preferences." };
  }
}

export async function enqueueTestNotificationAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { user } = await requireUser();
    if (!user) {
      return { ok: false, error: "Sign in required." };
    }

    const householdIdRaw = String(formData.get("householdId") ?? "").trim();
    const householdId = uuidSchema.safeParse(householdIdRaw).success
      ? householdIdRaw
      : null;
    if (householdId) {
      await assertActiveMembership(householdId);
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await db(supabase).rpc("enqueue_test_notification");

    if (error) {
      const msg = error.message ?? "";
      if (msg.toLowerCase().includes("rate limit")) {
        return {
          ok: false,
          error: "Wait 60 seconds before sending another test notification.",
        };
      }
      logServerError("enqueueTestNotification", error, { userId: user.id });
      return { ok: false, error: "Could not enqueue a test notification." };
    }

    revalidateNotificationPaths(householdId);
    return {
      ok: true,
      message: "Test notification queued. Check this device shortly.",
    };
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    logServerError("enqueueTestNotification", e);
    return { ok: false, error: "Could not enqueue a test notification." };
  }
}

export async function markNotificationReadAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = z
      .object({
        householdId: z.string().uuid(),
        notificationId: z.string().uuid(),
      })
      .safeParse({
        householdId: formData.get("householdId"),
        notificationId: formData.get("notificationId"),
      });
    if (!parsed.success) return { ok: false, error: "Invalid notification." };

    await assertActiveMembership(parsed.data.householdId);
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await db(supabase).rpc("mark_notification_read", {
      p_notification_id: parsed.data.notificationId,
    });
    if (error) {
      logServerError("markNotificationRead", error);
      return { ok: false, error: "Could not update notification." };
    }
    revalidateNotificationPaths(parsed.data.householdId);
    return { ok: true };
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    logServerError("markNotificationRead", e);
    return { ok: false, error: "Could not update notification." };
  }
}

export async function markNotificationUnreadAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = z
      .object({
        householdId: z.string().uuid(),
        notificationId: z.string().uuid(),
      })
      .safeParse({
        householdId: formData.get("householdId"),
        notificationId: formData.get("notificationId"),
      });
    if (!parsed.success) return { ok: false, error: "Invalid notification." };

    await assertActiveMembership(parsed.data.householdId);
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await db(supabase).rpc("mark_notification_unread", {
      p_notification_id: parsed.data.notificationId,
    });
    if (error) {
      logServerError("markNotificationUnread", error);
      return { ok: false, error: "Could not update notification." };
    }
    revalidateNotificationPaths(parsed.data.householdId);
    return { ok: true };
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    logServerError("markNotificationUnread", e);
    return { ok: false, error: "Could not update notification." };
  }
}

export async function markAllNotificationsReadAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = z
      .object({
        householdId: z.string().uuid(),
        scopeHouseholdId: z.string().uuid().optional().nullable(),
      })
      .safeParse({
        householdId: formData.get("householdId"),
        scopeHouseholdId: formData.get("scopeHouseholdId") || null,
      });
    if (!parsed.success) return { ok: false, error: "Invalid request." };

    await assertActiveMembership(parsed.data.householdId);
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await db(supabase).rpc(
      "mark_all_notifications_read",
      {
        p_household_id: parsed.data.scopeHouseholdId ?? null,
      },
    );
    if (error) {
      logServerError("markAllNotificationsRead", error);
      return { ok: false, error: "Could not mark notifications as read." };
    }
    revalidateNotificationPaths(parsed.data.householdId);
    return { ok: true, message: "All notifications marked read." };
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    logServerError("markAllNotificationsRead", e);
    return { ok: false, error: "Could not mark notifications as read." };
  }
}
