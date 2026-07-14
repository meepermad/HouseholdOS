import { describe, expect, it } from "vitest";
import {
  ConfigurationError,
  parsePublicEnv,
  resetPublicEnvCache,
} from "@/lib/env/public";
import { parseServerEnv } from "@/lib/env/server-schema";
import { normalizeEmail } from "@/lib/env/server-schema";

describe("public env validation", () => {
  it("accepts a valid API gateway URL", () => {
    resetPublicEnvCache();
    const env = parsePublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://abcdefgh.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pk_test_abcdefghijklmnopqrstuvwxyz",
    });
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toContain("supabase.co");
  });

  it("rejects dashboard URLs", () => {
    expect(() =>
      parsePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://supabase.com/dashboard/project/abc",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pk_test_abcdefghijklmnopqrstuvwxyz",
      }),
    ).toThrow(ConfigurationError);
  });

  it("rejects missing publishable key", () => {
    expect(() =>
      parsePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      }),
    ).toThrow(ConfigurationError);
  });
});

describe("server env validation", () => {
  const base = {
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pk_test_abcdefghijklmnopqrstuvwxyz",
    APP_URL: "http://localhost:3000",
    APP_ENV: "development",
    REGISTRATION_MODE: "bootstrap_only",
    BOOTSTRAP_EMAIL: "  Admin@Example.COM ",
  };

  it("normalizes bootstrap email", () => {
    const env = parseServerEnv(base);
    expect(env.BOOTSTRAP_EMAIL).toBe("admin@example.com");
  });

  it("requires bootstrap email in bootstrap_only", () => {
    expect(() =>
      parseServerEnv({ ...base, BOOTSTRAP_EMAIL: undefined }),
    ).toThrow(ConfigurationError);
  });

  it("rejects open registration in production", () => {
    expect(() =>
      parseServerEnv({
        ...base,
        APP_ENV: "production",
        REGISTRATION_MODE: "open",
        BOOTSTRAP_EMAIL: undefined,
      }),
    ).toThrow(/open/i);
  });

  it("validates currency as three uppercase letters", () => {
    expect(() =>
      parseServerEnv({ ...base, DEFAULT_CURRENCY: "usd" }),
    ).toThrow(ConfigurationError);
  });

  it("validates timezone", () => {
    expect(() =>
      parseServerEnv({ ...base, DEFAULT_TIMEZONE: "Not/AZone" }),
    ).toThrow(ConfigurationError);
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Foo@Bar.COM ")).toBe("foo@bar.com");
  });
});
