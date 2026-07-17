import { describe, expect, it } from "vitest";
import {
  authorizeWorkerSecret,
  authorizeNotificationWorker,
} from "@/lib/notifications/auth-worker";

function requestWithBearer(token: string | null): Request {
  const headers = new Headers();
  if (token !== null) {
    headers.set("authorization", `Bearer ${token}`);
  }
  return new Request("http://localhost/api/internal/test", { method: "POST", headers });
}

describe("worker secret authorization", () => {
  const notificationSecret = "notification-secret-16";
  const documentSecret = "document-job-secret16";
  const exportSecret = "export-worker-secret1";

  it("rejects missing configuration", () => {
    const result = authorizeWorkerSecret(
      requestWithBearer(notificationSecret),
      undefined,
      "Notification",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
      expect(result.error).toMatch(/not configured/i);
    }
  });

  it("rejects missing bearer", () => {
    const result = authorizeWorkerSecret(
      requestWithBearer(null),
      notificationSecret,
      "Notification",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });

  it("accepts matching family secret", () => {
    expect(
      authorizeWorkerSecret(
        requestWithBearer(documentSecret),
        documentSecret,
        "Document job",
      ).ok,
    ).toBe(true);
    expect(
      authorizeWorkerSecret(
        requestWithBearer(exportSecret),
        exportSecret,
        "Export",
      ).ok,
    ).toBe(true);
  });

  it("rejects wrong-family secret (notification secret must not unlock document jobs)", () => {
    const result = authorizeWorkerSecret(
      requestWithBearer(notificationSecret),
      documentSecret,
      "Document job",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });

  it("rejects wrong-family secret (export secret must not unlock notifications)", () => {
    const result = authorizeNotificationWorker(
      requestWithBearer(exportSecret),
      notificationSecret,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects length-mismatched secrets without throwing", () => {
    const result = authorizeWorkerSecret(
      requestWithBearer("short"),
      notificationSecret,
      "Notification",
    );
    expect(result.ok).toBe(false);
  });
});
