import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { deactivatePushSubscriptionAction } from "@/app/actions/notifications";
import type { PushDeviceRow } from "@/lib/notifications/queries";

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function DeviceSubscriptionList({
  householdId,
  devices,
}: {
  householdId: string;
  devices: PushDeviceRow[];
}) {
  if (devices.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        No registered devices yet. Enable push above to add this browser.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-md border border-border" data-testid="device-subscription-list">
      {devices.map((device) => (
        <li
          key={device.id}
          className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5"
        >
          <div className="min-w-0 space-y-0.5 text-sm">
            <p className="font-medium text-text-primary">
              {device.deviceLabel?.trim() || "Unnamed device"}
              {!device.active ? (
                <span className="ml-2 text-xs font-normal text-text-muted">
                  (inactive)
                </span>
              ) : null}
            </p>
            <p className="text-text-secondary">
              {device.userAgentSummary ?? device.platformCategory ?? "Unknown"}
            </p>
            <p className="text-xs text-text-muted">
              Updated {formatWhen(device.updatedAt)}
              {device.lastSuccessAt
                ? ` · Last success ${formatWhen(device.lastSuccessAt)}`
                : ""}
            </p>
            {device.disabledReason ? (
              <p className="text-xs text-text-muted">
                Reason: {device.disabledReason}
              </p>
            ) : null}
          </div>
          {device.active ? (
            <ActionForm action={deactivatePushSubscriptionAction}>
              <input type="hidden" name="householdId" value={householdId} />
              <input type="hidden" name="subscriptionId" value={device.id} />
              <SubmitButton
                variant="secondary"
                pendingLabel="Removing…"
                className="text-xs"
              >
                Remove
              </SubmitButton>
            </ActionForm>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
