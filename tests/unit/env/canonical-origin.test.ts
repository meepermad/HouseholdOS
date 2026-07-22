import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildInvitationJoinUrl,
  getCanonicalAppOrigin,
  getInvitationOriginReadiness,
  InvitationOriginConfigurationError,
  normalizeCanonicalOrigin,
  PRODUCTION_ORIGIN_MISCONFIG,
} from "@/lib/env/canonical-origin";
import { parseServerEnv } from "@/lib/env/server-schema";

const publicBase = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pk_test_abcdefghijklmnopqrstuvwxyz",
};

describe("getCanonicalAppOrigin", () => {
  it("uses production APP_URL for HTTPS production invite links", () => {
    const origin = getCanonicalAppOrigin({
      APP_URL: "https://household-os-five.vercel.app",
      APP_ENV: "production",
    });
    expect(origin).toBe("https://household-os-five.vercel.app");
    expect(
      buildInvitationJoinUrl("tok_abcdefghijklmnopqrstuvwxyz012345", origin),
    ).toBe(
      "https://household-os-five.vercel.app/join/tok_abcdefghijklmnopqrstuvwxyz012345",
    );
  });

  it("normalizes trailing slash", () => {
    expect(
      getCanonicalAppOrigin({
        APP_URL: "https://household-os-five.vercel.app/",
        APP_ENV: "production",
      }),
    ).toBe("https://household-os-five.vercel.app");
  });

  it("falls back to localhost in development when APP_URL is unset", () => {
    expect(
      getCanonicalAppOrigin({
        APP_ENV: "development",
      }),
    ).toBe("http://localhost:3000");
  });

  it("fails safely when production APP_URL is missing", () => {
    expect(() =>
      getCanonicalAppOrigin({
        APP_ENV: "production",
      }),
    ).toThrow(InvitationOriginConfigurationError);
    expect(() =>
      getCanonicalAppOrigin({
        APP_ENV: "production",
      }),
    ).toThrow(PRODUCTION_ORIGIN_MISCONFIG);
  });

  it("rejects HTTP production origin", () => {
    expect(() =>
      getCanonicalAppOrigin({
        APP_URL: "http://household-os-five.vercel.app",
        APP_ENV: "production",
      }),
    ).toThrow(/https/i);
  });

  it("rejects origin containing credentials", () => {
    expect(() =>
      normalizeCanonicalOrigin("https://user:pass@household-os-five.vercel.app", {
        requireHttps: true,
        allowLocalhost: false,
      }),
    ).toThrow(/credentials/i);
  });

  it("rejects origin containing path, query, or fragment", () => {
    expect(() =>
      normalizeCanonicalOrigin("https://household-os-five.vercel.app/app", {
        requireHttps: true,
        allowLocalhost: false,
      }),
    ).toThrow(/path/i);
    expect(() =>
      normalizeCanonicalOrigin("https://household-os-five.vercel.app?x=1", {
        requireHttps: true,
        allowLocalhost: false,
      }),
    ).toThrow(/query|fragment/i);
    expect(() =>
      normalizeCanonicalOrigin("https://household-os-five.vercel.app#frag", {
        requireHttps: true,
        allowLocalhost: false,
      }),
    ).toThrow(/query|fragment/i);
  });

  it("never returns localhost for production", () => {
    expect(() =>
      getCanonicalAppOrigin({
        APP_URL: "http://localhost:3000",
        APP_ENV: "production",
      }),
    ).toThrow(InvitationOriginConfigurationError);

    expect(() =>
      getCanonicalAppOrigin({
        APP_URL: "https://localhost:3000",
        APP_ENV: "production",
      }),
    ).toThrow(InvitationOriginConfigurationError);

    // VERCEL_ENV=production without APP_ENV still treated as production
    expect(() =>
      getCanonicalAppOrigin({
        VERCEL_ENV: "production",
      }),
    ).toThrow(PRODUCTION_ORIGIN_MISCONFIG);
  });

  it("allows preview deployments to use VERCEL_URL when APP_URL is unset", () => {
    expect(
      getCanonicalAppOrigin({
        APP_ENV: "development",
        VERCEL_ENV: "preview",
        VERCEL_URL: "household-os-git-feature.vercel.app",
      }),
    ).toBe("https://household-os-git-feature.vercel.app");
  });

  it("reports safe readiness diagnostics without secrets", () => {
    const ready = getInvitationOriginReadiness({
      APP_URL: "https://household-os-five.vercel.app",
      APP_ENV: "production",
    });
    expect(ready).toEqual({
      invitation_origin_configured: true,
      invitation_origin_host: "household-os-five.vercel.app",
      invitation_origin_https: true,
    });

    const missing = getInvitationOriginReadiness({
      APP_ENV: "production",
    });
    expect(missing.invitation_origin_configured).toBe(false);
    expect(missing.invitation_origin_host).toBeNull();
  });
});

describe("parseServerEnv APP_URL", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("stores normalized production origin", () => {
    const env = parseServerEnv({
      ...publicBase,
      APP_URL: "https://household-os-five.vercel.app/",
      APP_ENV: "production",
      REGISTRATION_MODE: "invite_only",
    });
    expect(env.APP_URL).toBe("https://household-os-five.vercel.app");
    expect(env.APP_ENV).toBe("production");
  });

  it("rejects missing production APP_URL", () => {
    expect(() =>
      parseServerEnv({
        ...publicBase,
        APP_ENV: "production",
        REGISTRATION_MODE: "invite_only",
      }),
    ).toThrow(PRODUCTION_ORIGIN_MISCONFIG);
  });
});
