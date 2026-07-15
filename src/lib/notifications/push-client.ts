"use client";

import { registerPushSubscriptionAction } from "@/app/actions/notifications";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

/** SHA-256 hex to match server-side endpoint_hash. */
export async function hashEndpointBrowser(endpoint: string): Promise<string> {
  const data = new TextEncoder().encode(endpoint.trim());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function subscriptionToJson(sub: PushSubscription) {
  const json = sub.toJSON();
  return {
    endpoint: json.endpoint ?? sub.endpoint,
    expirationTime: json.expirationTime ?? null,
    keys: {
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
    },
  };
}

/**
 * Request permission (only when called), subscribe via PushManager, and
 * register the subscription with the server action.
 */
export async function subscribeCurrentDevice(opts: {
  vapidPublicKey: string;
  deviceLabel?: string;
  householdId?: string;
}): Promise<{ subscriptionId?: string }> {
  if (!opts.vapidPublicKey?.trim()) {
    throw new Error("Push is not configured on this deployment.");
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Web Push is not supported in this browser.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Notification permission was denied."
        : "Notification permission was not granted.",
    );
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        opts.vapidPublicKey.trim(),
      ) as BufferSource,
    });
  }

  const json = subscriptionToJson(subscription);
  const formData = new FormData();
  formData.set("endpoint", json.endpoint);
  formData.set("p256dh", json.keys.p256dh);
  formData.set("auth", json.keys.auth);
  if (json.expirationTime != null) {
    formData.set("expirationTime", String(json.expirationTime));
  }
  if (opts.deviceLabel?.trim()) {
    formData.set("deviceLabel", opts.deviceLabel.trim());
  }
  if (opts.householdId) {
    formData.set("householdId", opts.householdId);
  }

  const result = await registerPushSubscriptionAction(null, formData);
  if (!result.ok) {
    throw new Error(result.error);
  }

  return {
    subscriptionId: result.data?.subscriptionId,
  };
}

export async function getCurrentEndpointHash(): Promise<string | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return null;
    return hashEndpointBrowser(subscription.endpoint);
  } catch {
    return null;
  }
}

export async function unsubscribeCurrentDevice(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return false;
  }
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return false;
  return subscription.unsubscribe();
}
