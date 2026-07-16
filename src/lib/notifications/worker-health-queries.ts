import "server-only";

import { createClient } from "@/lib/supabase/server";

export type NotificationWorkerHealth = {
  lastAttemptedAt: string | null;
  lastSuccessfulAt: string | null;
  oldestQueuedDeliveryAt: string | null;
  oldestDueScheduledReminderAt: string | null;
  retryingCount: number;
  deadLetterCount: number;
  horizonsNeedingExtensionCount: number;
  lastHorizonExtensionAt: string | null;
  horizonExtensionCurrent: boolean;
  deliveryEnabled: boolean;
  workerConfigured: boolean;
  claimed: number;
  sent: number;
  retried: number;
  scheduledProcessed: number;
  calendarHorizonsExtended: number;
  empty: boolean;
  durationMs: number;
};

// Health RPC is newer than the generated database types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedDb = any;

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function getNotificationWorkerHealth(
  householdId: string,
): Promise<NotificationWorkerHealth> {
  const supabase = (await createClient()) as UntypedDb;
  const { data, error } = await supabase.rpc("get_notification_worker_health", {
    p_household_id: householdId,
  });
  if (error) {
    throw new Error(`Unable to load notification worker health: ${error.message}`);
  }

  const row = (data ?? {}) as Record<string, unknown>;
  return {
    lastAttemptedAt: nullableString(row.last_attempted_at),
    lastSuccessfulAt: nullableString(row.last_successful_at),
    oldestQueuedDeliveryAt: nullableString(row.oldest_queued_delivery_at),
    oldestDueScheduledReminderAt: nullableString(
      row.oldest_due_scheduled_reminder_at,
    ),
    retryingCount: count(row.retrying_count),
    deadLetterCount: count(row.dead_letter_count),
    horizonsNeedingExtensionCount: count(
      row.horizons_needing_extension_count,
    ),
    lastHorizonExtensionAt: nullableString(row.last_horizon_extension_at),
    horizonExtensionCurrent: row.horizon_extension_current === true,
    deliveryEnabled: row.delivery_enabled === true,
    workerConfigured: row.worker_configured === true,
    claimed: count(row.claimed),
    sent: count(row.sent),
    retried: count(row.retried),
    scheduledProcessed: count(row.scheduled_processed),
    calendarHorizonsExtended: count(row.calendar_horizons_extended),
    empty: row.empty !== false,
    durationMs: count(row.duration_ms),
  };
}
