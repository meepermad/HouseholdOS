import { describe, expect, it } from "vitest";
import { isAllowedSignInOrigin } from "@/lib/auth/sign-in-origin";
import {
  hasExhaustedSkewReload,
  isDeploymentSkewError,
  SKEW_RELOAD_KEY,
} from "@/lib/deployment-skew";

describe("isAllowedSignInOrigin", () => {
  it("accepts APP_URL origin", () => {
    expect(
      isAllowedSignInOrigin(
        "https://household-os-five.vercel.app",
        "https://household-os-five.vercel.app",
        "https://household-os-five.vercel.app/api/auth/sign-in",
      ),
    ).toBe(true);
  });

  it("accepts same request origin during local/preview", () => {
    expect(
      isAllowedSignInOrigin(
        "http://127.0.0.1:3000",
        "https://household-os-five.vercel.app",
        "http://127.0.0.1:3000/api/auth/sign-in",
      ),
    ).toBe(true);
  });

  it("rejects foreign origins", () => {
    expect(
      isAllowedSignInOrigin(
        "https://evil.example",
        "https://household-os-five.vercel.app",
        "https://household-os-five.vercel.app/api/auth/sign-in",
      ),
    ).toBe(false);
  });

  it("rejects missing origin", () => {
    expect(
      isAllowedSignInOrigin(
        null,
        "https://household-os-five.vercel.app",
        "https://household-os-five.vercel.app/api/auth/sign-in",
      ),
    ).toBe(false);
  });
});

describe("deployment skew helpers", () => {
  it("detects missing server action errors", () => {
    expect(
      isDeploymentSkewError(
        new Error(
          "Failed to find Server Action. This request might be from an older or newer deployment.",
        ),
      ),
    ).toBe(true);
  });

  it("reports exhausted reload after guard is set", () => {
    sessionStorage.setItem(SKEW_RELOAD_KEY, "1");
    sessionStorage.setItem("householdos_action_skew_reload_deploy", "dpl_abc");
    expect(hasExhaustedSkewReload("dpl_abc")).toBe(true);
    sessionStorage.clear();
  });
});
