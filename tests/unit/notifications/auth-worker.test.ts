import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { authorizeNotificationWorker } from "@/lib/notifications/auth-worker";

const SECRET = "notification-worker-secret-ok";

function requestWith(headers: Record<string, string>) {
  return new Request("https://example.test/api/internal/notifications/dispatch", {
    method: "POST",
    headers,
  });
}

describe("authorizeNotificationWorker", () => {
  it("rejects when secret is missing or too short", () => {
    const missing = authorizeNotificationWorker(requestWith({}), undefined);
    expect(missing).toEqual({
      ok: false,
      status: 503,
      error: "Notification worker secret is not configured",
    });

    const short = authorizeNotificationWorker(requestWith({}), "tiny");
    expect(short.ok).toBe(false);
    if (!short.ok) expect(short.status).toBe(503);
  });

  it("rejects missing or invalid bearer tokens", () => {
    const noHeader = authorizeNotificationWorker(requestWith({}), SECRET);
    expect(noHeader).toMatchObject({ ok: false, status: 401 });

    const bad = authorizeNotificationWorker(
      requestWith({ authorization: "Bearer wrong-secret-value-!!" }),
      SECRET,
    );
    expect(bad).toMatchObject({ ok: false, status: 401 });
  });

  it("accepts a matching bearer token", () => {
    const ok = authorizeNotificationWorker(
      requestWith({ authorization: `Bearer ${SECRET}` }),
      SECRET,
    );
    expect(ok).toEqual({ ok: true });
  });

  it("ignores cookies and only trusts the Authorization header", () => {
    const withCookie = authorizeNotificationWorker(
      requestWith({
        cookie: `session=${SECRET}`,
        authorization: "Bearer not-the-secret!!!!!!!!!!!!!",
      }),
      SECRET,
    );
    expect(withCookie).toMatchObject({ ok: false, status: 401 });

    const cookieOnly = authorizeNotificationWorker(
      requestWith({ cookie: `Authorization=Bearer ${SECRET}` }),
      SECRET,
    );
    expect(cookieOnly).toMatchObject({ ok: false, status: 401 });
  });
});
