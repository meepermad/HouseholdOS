"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  detectPushSupport,
  type PushSupportState,
} from "@/lib/notifications/push-support";
import {
  subscribeCurrentDevice,
  unsubscribeCurrentDevice,
  getCurrentEndpointHash,
} from "@/lib/notifications/push-client";
import { deactivateCurrentEndpointAction } from "@/app/actions/notifications";

const STATE_COPY: Record<PushSupportState, { title: string; body: string }> = {
  unsupported: {
    title: "Push not supported",
    body: "This browser does not support Web Push notifications.",
  },
  installation_required: {
    title: "Install HouseholdOS first",
    body: "On iPhone or iPad, add HouseholdOS to your Home Screen, then open it from there to enable push alerts.",
  },
  not_requested: {
    title: "Enable push on this device",
    body: "Get alerts for payments, disputes, and other household updates. You can change this later.",
  },
  granted: {
    title: "Permission granted",
    body: "Finish enabling push to register this device for alerts.",
  },
  denied: {
    title: "Permission blocked",
    body: "Notifications are blocked for this site. Update browser or system settings to allow them, then try again.",
  },
  subscription_missing: {
    title: "Register this device",
    body: "Permission is granted, but this device is not subscribed yet.",
  },
  subscribed: {
    title: "Push enabled",
    body: "This device is registered for HouseholdOS push alerts.",
  },
  subscription_error: {
    title: "Could not check subscription",
    body: "Something went wrong while checking push status. Try again.",
  },
};

export function PushPermissionCard({
  householdId,
  vapidPublicKey,
}: {
  householdId: string;
  vapidPublicKey?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<PushSupportState>("not_requested");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    const result = await detectPushSupport();
    setState(result.state);
    setReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void detectPushSupport().then((result) => {
      if (cancelled) return;
      setState(result.state);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const copy = STATE_COPY[state];
  const canEnable =
    ready &&
    Boolean(vapidPublicKey) &&
    (state === "not_requested" ||
      state === "granted" ||
      state === "subscription_missing" ||
      state === "subscription_error");

  function onEnable() {
    if (!vapidPublicKey) {
      setError("Push is not configured on this deployment.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await subscribeCurrentDevice({
          vapidPublicKey,
          householdId,
          deviceLabel: "This device",
        });
        await refresh();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not enable push.");
        await refresh();
      }
    });
  }

  function onDisable() {
    setError(null);
    startTransition(async () => {
      try {
        const hash = await getCurrentEndpointHash();
        await unsubscribeCurrentDevice();
        if (hash) {
          const fd = new FormData();
          fd.set("householdId", householdId);
          fd.set("endpointHash", hash);
          await deactivateCurrentEndpointAction(null, fd);
        }
        await refresh();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not disable push.");
        await refresh();
      }
    });
  }

  return (
    <div className="space-y-3" data-testid="push-permission-card">
      <div>
        <h2 className="text-base font-semibold text-text-primary">{copy.title}</h2>
        <p className="mt-1 text-sm text-text-secondary">{copy.body}</p>
      </div>
      {!vapidPublicKey ? (
        <p className="text-sm text-text-muted">
          Push delivery is not configured (missing public VAPID key).
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {canEnable ? (
          <button
            type="button"
            disabled={pending}
            onClick={onEnable}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {pending ? "Enabling…" : "Enable alerts"}
          </button>
        ) : null}
        {ready && state === "subscribed" ? (
          <button
            type="button"
            disabled={pending}
            onClick={onDisable}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground disabled:opacity-60"
          >
            {pending ? "Disabling…" : "Disable on this device"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
