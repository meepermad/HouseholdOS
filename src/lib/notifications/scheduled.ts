/**
 * Foundation types for scheduled_notification_requests.
 *
 * Cancellation semantics: a row with `processed_at` null and `cancelled_at` set
 * must not be emitted by the scheduler worker.
 */

export type ScheduleRequestInput = {
  householdId: string;
  sourceType: string;
  sourceId: string;
  recipientUserId: string;
  eventType: string;
  /** Wall-clock or instant when delivery becomes eligible. */
  scheduledAt: Date | string;
  channel?: "push" | "email" | "in_app";
  payload?: Record<string, unknown>;
  quietHoursRespected?: boolean;
};

export function buildScheduleIdempotencyKey(
  sourceType: string,
  sourceId: string,
  recipientUserId: string,
  eventType: string,
  scheduledAt: Date | string,
): string {
  const at =
    typeof scheduledAt === "string"
      ? scheduledAt
      : scheduledAt.toISOString();
  return [sourceType, sourceId, recipientUserId, eventType, at].join(":");
}

export function isScheduleCancelled(row: {
  processed_at: string | null;
  cancelled_at: string | null;
}): boolean {
  return row.processed_at == null && row.cancelled_at != null;
}
