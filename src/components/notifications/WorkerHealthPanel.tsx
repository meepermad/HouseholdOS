import { Surface } from "@/components/ui/surface";
import {
  classifyWorkerHealth,
  type WorkerHealthStatus,
} from "@/lib/notifications/worker-health";
import type { NotificationWorkerHealth } from "@/lib/notifications/worker-health-queries";

function formatTime(value: string | null): string {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

function statusClass(status: WorkerHealthStatus): string {
  if (status === "Healthy") return "text-success";
  if (status === "Delayed" || status === "Reminder backlog") {
    return "text-warning";
  }
  return "text-destructive";
}

export function WorkerHealthPanel({
  health,
}: {
  health: NotificationWorkerHealth;
}) {
  const status = classifyWorkerHealth({
    workerConfigured: health.workerConfigured,
    deliveryEnabled: health.deliveryEnabled,
    lastSuccessfulAt: health.lastSuccessfulAt,
    oldestDueScheduledReminderAt: health.oldestDueScheduledReminderAt,
    horizonsNeedingExtensionCount: health.horizonsNeedingExtensionCount,
    lastHorizonExtensionAt: health.lastHorizonExtensionAt,
    deadLetterCount: health.deadLetterCount,
  });

  const metrics = [
    ["Last attempted", formatTime(health.lastAttemptedAt)],
    ["Last successful", formatTime(health.lastSuccessfulAt)],
    ["Oldest queued delivery", formatTime(health.oldestQueuedDeliveryAt)],
    [
      "Oldest due reminder",
      formatTime(health.oldestDueScheduledReminderAt),
    ],
    ["Retrying deliveries", String(health.retryingCount)],
    ["Dead-letter deliveries", String(health.deadLetterCount)],
    [
      "Horizons needing extension",
      String(health.horizonsNeedingExtensionCount),
    ],
    ["Last horizon extension", formatTime(health.lastHorizonExtensionAt)],
    ["Last run duration", `${health.durationMs} ms`],
  ] as const;

  return (
    <Surface className="space-y-5" data-testid="worker-health-panel">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Current status
        </p>
        <p className={`mt-1 text-xl font-semibold ${statusClass(status)}`}>
          {status}
        </p>
        <p className="mt-1 text-sm text-text-secondary">
          Delivery {health.deliveryEnabled ? "enabled" : "disabled"} · Calendar
          horizon {health.horizonExtensionCurrent ? "current" : "needs work"}
        </p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        {metrics.map(([label, value]) => (
          <div key={label} className="rounded-md bg-surface-secondary p-3">
            <dt className="text-xs text-text-muted">{label}</dt>
            <dd className="mt-1 text-sm font-medium text-text-primary">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </Surface>
  );
}
