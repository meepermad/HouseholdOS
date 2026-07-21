import { describe, expect, it } from "vitest";
import {
  buildContentSecurityPolicy,
  createCspNonce,
} from "@/lib/security/csp";

describe("CSP for React Flight Suspense reveal", () => {
  it("includes a per-request script nonce (required for inline $RC/$RS)", () => {
    const nonce = createCspNonce();
    const csp = buildContentSecurityPolicy({
      nonce,
      supabaseOrigin: "https://example.supabase.co",
    });

    expect(csp).toContain(`'nonce-${nonce}'`);
    expect(csp).toContain("script-src");
    expect(csp).toContain("'strict-dynamic'");
    // Static policies without nonce/unsafe-inline leave Suspense fallbacks stuck.
    expect(csp).not.toMatch(/script-src [^;]*'unsafe-inline'/);
  });

  it("keeps wasm/eval allowances needed by OCR workers", () => {
    const csp = buildContentSecurityPolicy({ nonce: "test-nonce" });
    expect(csp).toContain("'wasm-unsafe-eval'");
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("worker-src 'self' blob:");
  });
});
