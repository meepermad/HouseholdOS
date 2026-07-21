import { describe, expect, it } from "vitest";
import { isDeploymentSkewError } from "@/lib/deployment-skew";

describe("isDeploymentSkewError", () => {
  it("matches Next.js server action skew messages", () => {
    expect(
      isDeploymentSkewError(
        new Error(
          "Failed to find Server Action. This request might be from an older or newer deployment.",
        ),
      ),
    ).toBe(true);
  });

  it("rejects unrelated errors", () => {
    expect(isDeploymentSkewError(new Error("Network error"))).toBe(false);
    expect(isDeploymentSkewError(null)).toBe(false);
  });
});
