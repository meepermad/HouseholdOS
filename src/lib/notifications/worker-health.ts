export type WorkerHealthStatus =
  | "Healthy"
  | "Delayed"
  | "Worker not configured"
  | "Delivery disabled"
  | "Reminder backlog"
  | "Calendar horizon stale"
  | "Dead-letter attention needed";

/** Worker is delayed after ten minutes without a successful delivery run. */
export const WORKER_DELAYED_AFTER_MS = 10 * 60 * 1000;
/** A due scheduled reminder becomes a backlog after fifteen minutes. */
export const REMINDER_BACKLOG_AFTER_MS = 15 * 60 * 1000;
/** Calendar horizon work is stale after two hours without an extension. */
export const HORIZON_STALE_AFTER_MS = 2 * 60 * 60 * 1000;

export type WorkerHealthInput = {
  workerConfigured: boolean;
  deliveryEnabled: boolean;
  lastSuccessfulAt: string | Date | null;
  oldestDueScheduledReminderAt: string | Date | null;
  horizonsNeedingExtensionCount: number;
  lastHorizonExtensionAt: string | Date | null;
  deadLetterCount: number;
  now?: string | Date;
};

function timestamp(value: string | Date | null): number | null {
  if (value == null) return null;
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

export function classifyWorkerHealth(
  input: WorkerHealthInput,
): WorkerHealthStatus {
  const now = timestamp(input.now ?? new Date()) ?? Date.now();

  // Priority is intentional: configuration and operator-action states should
  // not be hidden by lower-priority timing warnings.
  if (!input.workerConfigured) return "Worker not configured";
  if (!input.deliveryEnabled) return "Delivery disabled";
  if (input.deadLetterCount > 0) return "Dead-letter attention needed";

  if (input.horizonsNeedingExtensionCount > 0) {
    const lastExtension = timestamp(input.lastHorizonExtensionAt);
    if (
      lastExtension == null ||
      now - lastExtension > HORIZON_STALE_AFTER_MS
    ) {
      return "Calendar horizon stale";
    }
  }

  const oldestDue = timestamp(input.oldestDueScheduledReminderAt);
  if (oldestDue != null && now - oldestDue > REMINDER_BACKLOG_AFTER_MS) {
    return "Reminder backlog";
  }

  const lastSuccess = timestamp(input.lastSuccessfulAt);
  if (
    lastSuccess == null ||
    now - lastSuccess > WORKER_DELAYED_AFTER_MS
  ) {
    return "Delayed";
  }

  return "Healthy";
}
