import { describe, expect, it } from "vitest";
import { evaluateRegistration } from "@/lib/auth/registration-policy";

describe("registration policy", () => {
  it("allows bootstrap email in bootstrap_only", () => {
    const result = evaluateRegistration({
      mode: "bootstrap_only",
      email: "Owner@Example.com",
      bootstrapEmail: "owner@example.com",
      hasValidInvitationMatchingEmail: false,
      appEnv: "development",
    });
    expect(result.allowed).toBe(true);
  });

  it("allows invited email in bootstrap_only", () => {
    const result = evaluateRegistration({
      mode: "bootstrap_only",
      email: "roommate@example.com",
      bootstrapEmail: "owner@example.com",
      hasValidInvitationMatchingEmail: true,
      appEnv: "development",
    });
    expect(result.allowed).toBe(true);
  });

  it("rejects arbitrary email in bootstrap_only", () => {
    const result = evaluateRegistration({
      mode: "bootstrap_only",
      email: "stranger@example.com",
      bootstrapEmail: "owner@example.com",
      hasValidInvitationMatchingEmail: false,
      appEnv: "development",
    });
    expect(result.allowed).toBe(false);
  });

  it("requires invitation in invite_only", () => {
    const denied = evaluateRegistration({
      mode: "invite_only",
      email: "a@example.com",
      hasValidInvitationMatchingEmail: false,
      appEnv: "production",
    });
    expect(denied.allowed).toBe(false);

    const allowed = evaluateRegistration({
      mode: "invite_only",
      email: "a@example.com",
      hasValidInvitationMatchingEmail: true,
      appEnv: "production",
    });
    expect(allowed.allowed).toBe(true);
  });

  it("blocks open mode in production at policy layer", () => {
    const result = evaluateRegistration({
      mode: "open",
      email: "a@example.com",
      hasValidInvitationMatchingEmail: false,
      appEnv: "production",
    });
    expect(result.allowed).toBe(false);
  });
});
