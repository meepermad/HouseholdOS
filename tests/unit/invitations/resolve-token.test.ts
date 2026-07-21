import { describe, expect, it } from "vitest";
import {
  extractInviteTokenFromNext,
  resolveInviteToken,
} from "@/lib/invitations/resolve-token";
import { buildCleanAuthUrl } from "@/lib/security/sensitive-query";

describe("resolveInviteToken", () => {
  const token = "a".repeat(64);

  it("prefers explicit invite query", () => {
    expect(
      resolveInviteToken({
        invite: token,
        next: "/onboarding",
      }),
    ).toBe(token);
  });

  it("extracts token from /join/{token} next path", () => {
    expect(extractInviteTokenFromNext(`/join/${token}`)).toBe(token);
    expect(
      resolveInviteToken({
        invite: null,
        next: `/join/${token}`,
      }),
    ).toBe(token);
  });

  it("returns null when neither invite nor join next is present", () => {
    expect(resolveInviteToken({ invite: null, next: "/onboarding" })).toBeNull();
  });
});

describe("buildCleanAuthUrl preserves invite", () => {
  it("keeps invite token when stripping password query keys", () => {
    const token = "b".repeat(64);
    const dirty = new URLSearchParams();
    dirty.set("password", "not-a-real-password");
    dirty.set("invite", token);
    dirty.set("next", `/join/${token}`);
    const clean = buildCleanAuthUrl("https://example.test", "/signup", dirty);
    expect(clean.searchParams.get("invite")).toBe(token);
    expect(clean.searchParams.get("next")).toBe(`/join/${token}`);
    expect(clean.searchParams.has("password")).toBe(false);
  });
});
