import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generateInviteToken, hashInviteToken, slugifyHouseholdName } from "@/lib/tokens";

describe("tokens", () => {
  it("hashes invite tokens with sha256", () => {
    const token = "a".repeat(64);
    expect(hashInviteToken(token)).toBe(
      createHash("sha256").update(token).digest("hex"),
    );
  });

  it("generates unique tokens and slugs", () => {
    expect(generateInviteToken()).not.toEqual(generateInviteToken());
    expect(slugifyHouseholdName("Oak Street!")).toMatch(/^oak-street-[a-f0-9]+$/);
  });
});
