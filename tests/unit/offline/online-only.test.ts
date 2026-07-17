import { describe, expect, it } from "vitest";
import {
  assertOfflineAllowed,
  isOnlineOnlyAction,
} from "@/lib/offline/online-only";

describe("offline allowlist", () => {
  it("blocks financial confirms from the outbox", () => {
    expect(isOnlineOnlyAction("confirmPayment")).toBe(true);
    expect(isOnlineOnlyAction("proposeRoutedSettlement")).toBe(true);
    expect(() => assertOfflineAllowed("confirmPayment")).toThrow(/online/);
  });

  it("allows nonfinancial allowlisted actions", () => {
    expect(() => assertOfflineAllowed("addComment")).not.toThrow();
    expect(isOnlineOnlyAction("addComment")).toBe(false);
  });
});
