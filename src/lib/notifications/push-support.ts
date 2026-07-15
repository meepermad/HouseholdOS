/**
 * Client-safe push / notification feature detection.
 * Never requests permission — only observes current state.
 */

export type PushSupportState =
  | "unsupported"
  | "installation_required"
  | "not_requested"
  | "granted"
  | "denied"
  | "subscription_missing"
  | "subscribed"
  | "subscription_error";

export type PushSupportResult = {
  state: PushSupportState;
  permission: NotificationPermission | "unsupported";
  standalone: boolean;
  swSupported: boolean;
  pushSupported: boolean;
};

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
  } catch {
    /* ignore */
  }
  // iOS Safari home-screen PWA
  const nav = navigator as Navigator & { standalone?: boolean };
  if (typeof nav.standalone === "boolean" && nav.standalone) return true;
  return false;
}

function likelyIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/i.test(ua);
  const chromeIsh = /CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Firefox|Edg/i.test(ua);
  return iOS && webkit && !chromeIsh;
}

/**
 * Detects Web Push readiness without prompting for permission.
 */
export async function detectPushSupport(): Promise<PushSupportResult> {
  const unsupported: PushSupportResult = {
    state: "unsupported",
    permission: "unsupported",
    standalone: false,
    swSupported: false,
    pushSupported: false,
  };

  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return unsupported;
  }

  const standalone = isStandaloneDisplay();
  const notificationApi = "Notification" in window;
  const swSupported = "serviceWorker" in navigator;
  const pushManagerGlobal = "PushManager" in window;

  if (!notificationApi) {
    return { ...unsupported, standalone, swSupported };
  }

  // iOS: PushManager often only appears after install to home screen.
  if (
    !pushManagerGlobal &&
    notificationApi &&
    !standalone &&
    (likelyIosSafari() || "standalone" in navigator)
  ) {
    return {
      state: "installation_required",
      permission: Notification.permission,
      standalone,
      swSupported,
      pushSupported: false,
    };
  }

  if (!swSupported || !pushManagerGlobal) {
    return {
      state: "unsupported",
      permission: Notification.permission,
      standalone,
      swSupported,
      pushSupported: false,
    };
  }

  const permission = Notification.permission;
  if (permission === "denied") {
    return {
      state: "denied",
      permission,
      standalone,
      swSupported,
      pushSupported: true,
    };
  }

  if (permission === "default") {
    return {
      state: "not_requested",
      permission,
      standalone,
      swSupported,
      pushSupported: true,
    };
  }

  // permission === "granted"
  try {
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      return {
        state: "subscribed",
        permission,
        standalone,
        swSupported,
        pushSupported: true,
      };
    }
    return {
      state: "subscription_missing",
      permission,
      standalone,
      swSupported,
      pushSupported: true,
    };
  } catch {
    return {
      state: "subscription_error",
      permission,
      standalone,
      swSupported,
      pushSupported: true,
    };
  }
}
