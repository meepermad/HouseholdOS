/// <reference lib="webworker" />
export {};

declare const self: ServiceWorkerGlobalScope;

const FALLBACK_URL = "/app";
const FALLBACK_TITLE = "HouseholdOS";
const FALLBACK_BODY = "You have a new update. Open HouseholdOS to review it.";
const ICON = "/icons/icon-192.png";

const ALLOWED_PREFIXES = ["/app", "/onboarding", "/join", "/recovery"] as const;
const FORBIDDEN_SCHEME = /^(?:javascript|data|vbscript):/i;
const EXTERNAL_SCHEME = /^https?:/i;
const SENSITIVE_QUERY = /(?:^|[?&])(?:token|invite)=/i;

function isSafeInternalRoute(href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed.startsWith("/")) return false;
  if (trimmed.startsWith("//")) return false;
  if (FORBIDDEN_SCHEME.test(trimmed)) return false;
  if (EXTERNAL_SCHEME.test(trimmed)) return false;

  const pathOnly = trimmed.split(/[?#]/, 1)[0] ?? trimmed;
  const allowed = ALLOWED_PREFIXES.some(
    (prefix) => pathOnly === prefix || pathOnly.startsWith(`${prefix}/`),
  );
  if (!allowed) return false;

  const queryAndHash = trimmed.slice(pathOnly.length);
  if (SENSITIVE_QUERY.test(queryAndHash)) return false;
  return true;
}

function sanitizeUrl(url: unknown): string {
  if (typeof url !== "string") return FALLBACK_URL;
  const trimmed = url.trim();
  if (!trimmed) return FALLBACK_URL;
  return isSafeInternalRoute(trimmed) ? trimmed : FALLBACK_URL;
}

type PushPayload = {
  title?: unknown;
  body?: unknown;
  data?: { url?: unknown; [key: string]: unknown };
};

function parsePayload(event: PushEvent): {
  title: string;
  body: string;
  url: string;
} {
  let parsed: PushPayload = {};
  try {
    if (event.data) {
      parsed = event.data.json() as PushPayload;
    }
  } catch {
    try {
      const text = event.data?.text();
      if (text) parsed = JSON.parse(text) as PushPayload;
    } catch {
      parsed = {};
    }
  }

  const title =
    typeof parsed.title === "string" && parsed.title.trim()
      ? parsed.title.trim().slice(0, 120)
      : FALLBACK_TITLE;
  const body =
    typeof parsed.body === "string" && parsed.body.trim()
      ? parsed.body.trim().slice(0, 240)
      : FALLBACK_BODY;
  const url = sanitizeUrl(parsed.data?.url);

  return { title, body, url };
}

self.addEventListener("message", (event: ExtendableMessageEvent) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});

self.addEventListener("push", (event: PushEvent) => {
  const { title, body, url } = parsePayload(event);

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: ICON,
      badge: ICON,
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const rawUrl = (event.notification.data as { url?: unknown } | undefined)?.url;
  const targetUrl = sanitizeUrl(rawUrl);

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            await (client as WindowClient).navigate(targetUrl);
          }
          return;
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
