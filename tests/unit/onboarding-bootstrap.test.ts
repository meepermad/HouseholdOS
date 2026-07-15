import { describe, expect, it } from "vitest";
import {
  createHouseholdSchema,
  dollarsToCents,
} from "@/lib/validations/household";
import { parseInvitationPasteInput } from "@/lib/invitations/parse-paste";
import {
  mapHouseholdCreateError,
  mapInvitationError,
} from "@/lib/errors";

describe("dollarsToCents", () => {
  it("converts dollars to integer cents exactly", () => {
    expect(dollarsToCents("50")).toBe(5000);
    expect(dollarsToCents("50.00")).toBe(5000);
    expect(dollarsToCents("12.34")).toBe(1234);
    expect(dollarsToCents("0.01")).toBe(1);
  });

  it("rejects invalid amounts", () => {
    expect(Number.isNaN(dollarsToCents(""))).toBe(true);
    expect(Number.isNaN(dollarsToCents("12.345"))).toBe(true);
    expect(Number.isNaN(dollarsToCents("abc"))).toBe(true);
  });
});

describe("createHouseholdSchema", () => {
  const base = {
    name: "Our Place",
    propertyNickname: "",
    leaseStart: "",
    leaseEnd: "",
    timezone: "America/Chicago",
    currency: "usd",
    purchaseApprovalThresholdDollars: "50.00",
    acknowledgeReimbursementPolicy: "on",
  };

  it("normalizes optional empties to null and currency to uppercase", () => {
    const parsed = createHouseholdSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.propertyNickname).toBeNull();
    expect(parsed.data.leaseStart).toBeNull();
    expect(parsed.data.leaseEnd).toBeNull();
    expect(parsed.data.currency).toBe("USD");
    expect(parsed.data.purchaseApprovalThresholdCents).toBe(5000);
  });

  it("rejects lease end before start", () => {
    const parsed = createHouseholdSchema.safeParse({
      ...base,
      leaseStart: "2026-06-01",
      leaseEnd: "2026-05-01",
    });
    expect(parsed.success).toBe(false);
  });

  it("requires acknowledgment", () => {
    const parsed = createHouseholdSchema.safeParse({
      ...base,
      acknowledgeReimbursementPolicy: false,
    });
    expect(parsed.success).toBe(false);
  });
});

describe("parseInvitationPasteInput", () => {
  const token = "a".repeat(64);

  it("accepts raw tokens", () => {
    expect(parseInvitationPasteInput(token)).toEqual({ ok: true, token });
  });

  it("parses join URLs", () => {
    expect(
      parseInvitationPasteInput(`https://householdos.example/join/${token}`),
    ).toEqual({ ok: true, token });
  });

  it("rejects unrelated URLs", () => {
    const result = parseInvitationPasteInput("https://evil.example/phish");
    expect(result.ok).toBe(false);
  });
});

describe("onboarding error mapping", () => {
  it("maps create and invite failures to Phase 2.2 copy", () => {
    expect(mapHouseholdCreateError("Not authenticated").publicMessage).toBe(
      "You must sign in first.",
    );
    expect(mapHouseholdCreateError("Lease end must follow lease start").publicMessage).toBe(
      "Lease end must follow lease start.",
    );
    expect(mapInvitationError("Invitation email mismatch").publicMessage).toBe(
      "This invitation belongs to another email address.",
    );
    expect(mapInvitationError("Invitation expired").publicMessage).toBe(
      "This invitation expired.",
    );
  });
});
