import "server-only";

import { createPrivilegedClient } from "@/lib/supabase/privileged";
import { getServerEnv } from "@/lib/env/server";
import { getPublicEnv } from "@/lib/env/public";
import {
  createEmailAdapter,
  createInAppAdapter,
  createWebPushAdapter,
  type NotificationChannelAdapter,
} from "@/lib/notifications/adapters";
import { sanitizeNotificationDataUrl } from "@/lib/notifications/deep-links";
import {
  buildPushContent,
  validatePushPayloadSize,
  type PrivacyPreview,
} from "@/lib/notifications/templates";
import {
  nextRetryAt,
} from "@/lib/notifications/retry";

export type DispatchSummary = {
  correlationId: string;
  claimed: number;
  sent: number;
  retried: number;
  expired: number;
  deadLetter: number;
  subscriptionsDeactivated: number;
  scheduledProcessed: number;
  empty: boolean;
  durationMs: number;
};

type ClaimedDelivery = {
  id: string;
  user_id: string;
  event_id: string;
  user_notification_id: string | null;
  channel: string;
  status: string;
  claim_token: string | null;
  attempt_count: number;
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  active: boolean;
};

type PrivilegedClient = ReturnType<typeof createPrivilegedClient>;

/** Untyped access for delivery RPCs / tables not yet in generated Database types. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WorkerDb = any;

function workerDb(client: PrivilegedClient): WorkerDb {
  return client;
}

type ChannelOutcome = {
  sent: number;
  retried: number;
  expired: number;
  deadLetter: number;
  subscriptionsDeactivated: number;
};

/**
 * Claim and dispatch queued notification deliveries (web push + stubs).
 * Privacy preview comes from notification_quiet_hours.preview_mode (default generic).
 */
export async function dispatchNotificationDeliveries(options?: {
  batchSize?: number;
  webPushAdapter?: NotificationChannelAdapter;
  deliveryEnabled?: boolean;
}): Promise<DispatchSummary> {
  const started = Date.now();
  const correlationId = crypto.randomUUID();
  const env = getServerEnv();

  const deliveryEnabled =
    options?.deliveryEnabled ?? env.NOTIFICATION_DELIVERY_ENABLED === true;

  if (!deliveryEnabled) {
    console.info("[notifications.dispatch]", {
      correlationId,
      enabled: false,
      claimed: 0,
    });
    return {
      correlationId,
      claimed: 0,
      sent: 0,
      retried: 0,
      expired: 0,
      deadLetter: 0,
      subscriptionsDeactivated: 0,
      scheduledProcessed: 0,
      empty: true,
      durationMs: Date.now() - started,
    };
  }

  const batchSize = Math.min(Math.max(options?.batchSize ?? 50, 1), 100);
  const client = createPrivilegedClient();

  const publicEnv = getPublicEnv();
  const webPushAdapter =
    options?.webPushAdapter ??
    createWebPushAdapter({
      publicKey: publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      privateKey: env.VAPID_PRIVATE_KEY,
      subject: env.VAPID_SUBJECT,
      enabled: true,
    });
  const emailAdapter = createEmailAdapter(env);
  const inAppAdapter = createInAppAdapter();

  const db = workerDb(client);
  const { data: claimedRows, error: claimError } = await db.rpc(
    "claim_notification_deliveries",
    { p_batch_size: batchSize },
  );

  if (claimError) {
    console.error("[notifications.dispatch]", {
      correlationId,
      error: "claim_failed",
      message: claimError.message.slice(0, 200),
    });
    throw new Error(`claim_notification_deliveries failed: ${claimError.message}`);
  }

  const claimed = (claimedRows ?? []) as ClaimedDelivery[];
  let sent = 0;
  let retried = 0;
  let expired = 0;
  let deadLetter = 0;
  let subscriptionsDeactivated = 0;

  for (const delivery of claimed) {
    if (delivery.status !== "claimed" || !delivery.claim_token) {
      continue;
    }

    let outcome: ChannelOutcome;

    if (delivery.channel === "web_push") {
      outcome = await processWebPushDelivery({
        client,
        delivery,
        adapter: webPushAdapter,
      });
    } else if (delivery.channel === "email") {
      outcome = await processSimpleChannel({
        client,
        delivery,
        adapter: emailAdapter,
        input: { userId: delivery.user_id, eventId: delivery.event_id },
      });
    } else if (delivery.channel === "in_app") {
      outcome = await processSimpleChannel({
        client,
        delivery,
        adapter: inAppAdapter,
        input: {},
      });
    } else {
      await failDelivery(client, delivery, {
        failureCode: "unsupported_channel",
        failureCategory: "unsupported_channel",
        lastError: "Unsupported notification channel",
        retry: false,
      });
      outcome = {
        sent: 0,
        retried: 0,
        expired: 1,
        deadLetter: 0,
        subscriptionsDeactivated: 0,
      };
    }

    sent += outcome.sent;
    retried += outcome.retried;
    expired += outcome.expired;
    deadLetter += outcome.deadLetter;
    subscriptionsDeactivated += outcome.subscriptionsDeactivated;
  }

  const { data: scheduledCount, error: scheduledError } = await db.rpc(
    "process_due_scheduled_notifications",
    { p_limit: batchSize },
  );

  if (scheduledError) {
    console.error("[notifications.dispatch]", {
      correlationId,
      error: "scheduled_failed",
      message: scheduledError.message.slice(0, 200),
    });
  }

  const scheduledProcessed =
    typeof scheduledCount === "number" ? scheduledCount : 0;

  // Digest batch claim/send is not wired yet — groupDigestItems / nextDigestAt
  // exist for scheduling math only. Skip digest processing until a claim RPC lands.

  const summary: DispatchSummary = {
    correlationId,
    claimed: claimed.length,
    sent,
    retried,
    expired,
    deadLetter,
    subscriptionsDeactivated,
    scheduledProcessed,
    empty: claimed.length === 0 && scheduledProcessed === 0,
    durationMs: Date.now() - started,
  };

  console.info("[notifications.dispatch]", {
    correlationId,
    claimed: summary.claimed,
    sent: summary.sent,
    retried: summary.retried,
    expired: summary.expired,
    deadLetter: summary.deadLetter,
    subscriptionsDeactivated: summary.subscriptionsDeactivated,
    scheduledProcessed: summary.scheduledProcessed,
    durationMs: summary.durationMs,
  });

  return summary;
}

async function processSimpleChannel(args: {
  client: PrivilegedClient;
  delivery: ClaimedDelivery;
  adapter: NotificationChannelAdapter;
  input: unknown;
}): Promise<ChannelOutcome> {
  const { client, delivery, adapter, input } = args;
  const result = await adapter.send(input);
  if (result.ok) {
    await completeDelivery(client, delivery, result.providerMessageId);
    return {
      sent: 1,
      retried: 0,
      expired: 0,
      deadLetter: 0,
      subscriptionsDeactivated: 0,
    };
  }

  await failDelivery(client, delivery, {
    failureCode: result.failureCode,
    failureCategory: result.failureCategory,
    lastError: result.sanitizedMessage,
    retry: !result.permanent,
    retryDelaySeconds: result.permanent
      ? undefined
      : retryDelaySeconds(delivery.attempt_count),
  });

  if (result.permanent) {
    return {
      sent: 0,
      retried: 0,
      expired: 1,
      deadLetter: 0,
      subscriptionsDeactivated: 0,
    };
  }

  return {
    sent: 0,
    subscriptionsDeactivated: 0,
    ...classifyRetryOutcome(delivery),
    expired: 0,
  };
}

async function processWebPushDelivery(args: {
  client: PrivilegedClient;
  delivery: ClaimedDelivery;
  adapter: NotificationChannelAdapter;
}): Promise<ChannelOutcome> {
  const { client, delivery, adapter } = args;
  const empty: ChannelOutcome = {
    sent: 0,
    retried: 0,
    expired: 0,
    deadLetter: 0,
    subscriptionsDeactivated: 0,
  };

  const db = workerDb(client);
  // Service role bypasses RLS — worker-only path for subscription secrets.
  const { data: subscriptions, error: subError } = await db
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, active")
    .eq("user_id", delivery.user_id)
    .eq("active", true);

  if (subError) {
    await failDelivery(client, delivery, {
      failureCode: "subscription_lookup_failed",
      failureCategory: "transient",
      lastError: subError.message.slice(0, 200),
      retry: true,
      retryDelaySeconds: retryDelaySeconds(delivery.attempt_count),
    });
    return { ...empty, ...classifyRetryOutcome(delivery) };
  }

  const activeSubs = (subscriptions ?? []) as PushSubscriptionRow[];

  if (activeSubs.length === 0) {
    await failDelivery(client, delivery, {
      failureCode: "no_subscriptions",
      failureCategory: "no_subscriptions",
      lastError: "No active push subscriptions for user",
      retry: false,
    });
    return { ...empty, expired: 1 };
  }

  const content = await loadPushContent(client, delivery);
  if (!content) {
    await failDelivery(client, delivery, {
      failureCode: "missing_notification_content",
      failureCategory: "permanent",
      lastError: "Missing user_notification or event content",
      retry: false,
    });
    return { ...empty, expired: 1 };
  }

  const payload = {
    title: content.title,
    body: content.body,
    url: content.url,
    tag: delivery.event_id,
  };

  if (!validatePushPayloadSize(payload)) {
    await failDelivery(client, delivery, {
      failureCode: "payload_too_large",
      failureCategory: "permanent",
      lastError: "Push payload exceeds size limit",
      retry: false,
    });
    return { ...empty, expired: 1 };
  }

  let anySuccess = false;
  let anyTransient = false;
  let successSubscriptionId: string | undefined;
  let providerMessageId: string | undefined;
  let lastTransientCode = "transient";
  let lastTransientCategory = "transient";
  let lastTransientMessage = "Transient push failure";
  let subscriptionsDeactivated = 0;

  for (const sub of activeSubs) {
    const result = await adapter.send({
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      payload,
    });

    if (result.ok) {
      anySuccess = true;
      successSubscriptionId = sub.id;
      providerMessageId = result.providerMessageId;
      await db
        .from("push_subscriptions")
        .update({
          last_success_at: new Date().toISOString(),
          failure_count: 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sub.id);
      continue;
    }

    if (result.permanent) {
      // Permanent failures deactivate the endpoint; do not retry it.
      await db
        .from("push_subscriptions")
        .update({
          active: false,
          disabled_reason: result.failureCategory.slice(0, 120),
          last_failure_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", sub.id);
      subscriptionsDeactivated += 1;
      continue;
    }

    anyTransient = true;
    lastTransientCode = result.failureCode;
    lastTransientCategory = result.failureCategory;
    lastTransientMessage = result.sanitizedMessage;
    await db
      .from("push_subscriptions")
      .update({
        last_failure_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", sub.id);
  }

  if (anySuccess) {
    await completeDelivery(
      client,
      delivery,
      providerMessageId,
      successSubscriptionId,
    );
    return { ...empty, sent: 1, subscriptionsDeactivated };
  }

  if (!anyTransient) {
    await failDelivery(client, delivery, {
      failureCode: "all_subscriptions_failed",
      failureCategory: "all_subscriptions_failed",
      lastError: "All push subscriptions permanently failed",
      retry: false,
    });
    return { ...empty, expired: 1, subscriptionsDeactivated };
  }

  await failDelivery(client, delivery, {
    failureCode: lastTransientCode,
    failureCategory: lastTransientCategory,
    lastError: lastTransientMessage,
    retry: true,
    retryDelaySeconds: retryDelaySeconds(delivery.attempt_count),
  });

  return {
    ...empty,
    subscriptionsDeactivated,
    ...classifyRetryOutcome(delivery),
  };
}

/** Align with fail_notification_delivery: retry while (attempt_count + 1) < 8. */
function classifyRetryOutcome(
  delivery: ClaimedDelivery,
): Pick<ChannelOutcome, "retried" | "deadLetter"> {
  if (delivery.attempt_count + 1 < 8) {
    return { retried: 1, deadLetter: 0 };
  }
  return { retried: 0, deadLetter: 1 };
}

function retryDelaySeconds(attemptCount: number): number {
  const next = nextRetryAt(attemptCount, new Date());
  if (!next) return 60;
  return Math.min(
    Math.max(Math.round((next.getTime() - Date.now()) / 1000), 5),
    86_400,
  );
}

async function loadPushContent(
  client: PrivilegedClient,
  delivery: ClaimedDelivery,
): Promise<{ title: string; body: string; url: string } | null> {
  const db = workerDb(client);
  let title: string | undefined;
  let body: string | undefined;
  let href: string | null | undefined;
  let eventType: string | undefined;

  if (delivery.user_notification_id) {
    const { data: un } = await db
      .from("user_notifications")
      .select("title, body, action_href, event_id")
      .eq("id", delivery.user_notification_id)
      .maybeSingle();
    if (un) {
      title = un.title as string;
      body = un.body as string;
      href = un.action_href as string | null;
      const { data: event } = await db
        .from("notification_events")
        .select("event_type")
        .eq("id", un.event_id as string)
        .maybeSingle();
      eventType = event?.event_type as string | undefined;
    }
  }

  if (!eventType) {
    const { data: event } = await db
      .from("notification_events")
      .select("event_type")
      .eq("id", delivery.event_id)
      .maybeSingle();
    eventType = event?.event_type as string | undefined;
  }

  if (!title) {
    const { data: un } = await db
      .from("user_notifications")
      .select("title, body, action_href")
      .eq("event_id", delivery.event_id)
      .eq("user_id", delivery.user_id)
      .maybeSingle();
    if (un) {
      title = title ?? (un.title as string);
      body = body ?? (un.body as string);
      href = href ?? (un.action_href as string | null);
    }
  }

  if (!eventType) return null;

  let privacyPreview: PrivacyPreview = "generic";
  const { data: quiet } = await db
    .from("notification_quiet_hours")
    .select("preview_mode")
    .eq("user_id", delivery.user_id)
    .maybeSingle();
  if (quiet?.preview_mode === "detailed" || quiet?.preview_mode === "generic") {
    privacyPreview = quiet.preview_mode;
  }

  const built = buildPushContent(eventType, { privacyPreview });

  return {
    title: built.title || title || "HouseholdOS",
    body: built.body || body || "Open HouseholdOS to review it.",
    url: sanitizeNotificationDataUrl(href),
  };
}

async function completeDelivery(
  client: PrivilegedClient,
  delivery: ClaimedDelivery,
  providerMessageId?: string,
  subscriptionId?: string,
): Promise<void> {
  await workerDb(client).rpc("complete_notification_delivery", {
    p_delivery_id: delivery.id,
    p_claim_token: delivery.claim_token,
    p_provider_message_id: providerMessageId ?? null,
    p_subscription_id: subscriptionId ?? null,
  });
}

async function failDelivery(
  client: PrivilegedClient,
  delivery: ClaimedDelivery,
  opts: {
    failureCode: string;
    failureCategory: string;
    lastError: string;
    retry: boolean;
    retryDelaySeconds?: number;
    subscriptionId?: string;
  },
): Promise<void> {
  await workerDb(client).rpc("fail_notification_delivery", {
    p_delivery_id: delivery.id,
    p_claim_token: delivery.claim_token,
    p_failure_code: opts.failureCode,
    p_failure_category: opts.failureCategory,
    p_last_error: opts.lastError,
    p_retry: opts.retry,
    p_retry_delay_seconds: opts.retryDelaySeconds ?? 60,
    p_subscription_id: opts.subscriptionId ?? null,
  });
}
