import { describe, expect, it } from "vitest";
import {
  FEATURE_MATURITY,
  featureMaturity,
  isFeatureUsable,
  maturityLabel,
} from "@/lib/launch/feature-maturity";

describe("feature maturity", () => {
  it("hides digest because delivery is not wired", () => {
    expect(featureMaturity("notificationDigest").status).toBe("unavailable");
    expect(isFeatureUsable("notificationDigest")).toBe(false);
  });

  it("labels incomplete surfaces as beta or preview", () => {
    expect(FEATURE_MATURITY.productLookup.status).toBe("beta");
    expect(FEATURE_MATURITY.googleCalendarSync.status).toBe("preview");
    expect(maturityLabel("beta")).toBe("Beta");
    expect(maturityLabel("stable")).toBeNull();
  });
});
