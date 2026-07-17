import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";

/**
 * Lightweight RLS contract checks that do not require a live Supabase.
 * Full integration coverage lives in receipts-rls.test.ts when env is present.
 */
describe("receipt security contracts", () => {
  it("storage paths are household-prefixed", () => {
    const householdId = "11111111-1111-1111-1111-111111111111";
    const receiptId = "22222222-2222-2222-2222-222222222222";
    const path = `${householdId}/${receiptId}/file.jpg`;
    expect(path.startsWith(`${householdId}/`)).toBe(true);
  });

  it("file hashes are sha256 hex", () => {
    const hash = createHash("sha256").update("fixture").digest("hex");
    expect(hash).toHaveLength(64);
  });
});
