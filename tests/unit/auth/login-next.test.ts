import { describe, expect, it } from "vitest";
import {
  loginUrlForPath,
  receiptCaptureReturnPath,
  safeLoginReturnPath,
} from "@/lib/auth/login-next";

const H1 = "11111111-1111-4111-8111-111111111111";

describe("safeLoginReturnPath", () => {
  it("keeps a receipt capture deep link after login", () => {
    expect(safeLoginReturnPath(`/app/${H1}/money/receipts/new?mode=camera`)).toBe(
      `/app/${H1}/money/receipts/new?mode=camera`,
    );
    expect(safeLoginReturnPath(`/app/${H1}/money/receipts/new?mode=paste`)).toBe(
      `/app/${H1}/money/receipts/new?mode=paste`,
    );
  });

  it("returns to paste receipt after a dropped session", () => {
    expect(receiptCaptureReturnPath(H1, "paste")).toBe(
      `/app/${H1}/money/receipts/new?mode=paste`,
    );
  });

  it("rejects external and recovery destinations", () => {
    expect(safeLoginReturnPath("https://evil.example")).toBe("/app");
    expect(safeLoginReturnPath("/recovery")).toBe("/app");
    expect(safeLoginReturnPath("/auth/callback")).toBe("/app");
  });

  it("builds a session-expired login URL back to Add receipt", () => {
    const next = receiptCaptureReturnPath(H1);
    expect(loginUrlForPath(next, "session_expired")).toBe(
      `/login?next=${encodeURIComponent(next)}&reason=session_expired`,
    );
  });
});
