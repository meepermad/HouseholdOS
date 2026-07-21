import { describe, expect, it } from "vitest";
import {
  coordinatorMessageForDelivery,
  diagnosticForCategory,
  mapAuthInviteError,
} from "@/lib/invitations/diagnostics";

describe("invitation Auth diagnostics", () => {
  it("maps Before User Created rejection", () => {
    const mapped = mapAuthInviteError({
      message: "Registration is not available.",
      status: 403,
    });
    expect(mapped.outcome).toBe("failed");
    if (mapped.outcome === "failed") {
      expect(mapped.category).toBe("hook_rejection");
      expect(mapped.diagnostic).toContain("pending invitation");
    }
  });

  it("maps global signup disabled", () => {
    const mapped = mapAuthInviteError({
      message: "Signups not allowed for this instance",
      code: "signup_disabled",
    });
    expect(mapped.outcome).toBe("failed");
    if (mapped.outcome === "failed") {
      expect(mapped.category).toBe("signup_disabled");
      expect(mapped.diagnostic).toContain("Enable new-user signup");
      expect(mapped.diagnostic).toContain("Before User Created");
    }
  });

  it("maps email provider disabled", () => {
    const mapped = mapAuthInviteError({
      message: "Email logins are disabled",
    });
    expect(mapped.outcome).toBe("failed");
    if (mapped.outcome === "failed") {
      expect(mapped.category).toBe("email_provider_disabled");
      expect(mapped.diagnostic).toBe(
        diagnosticForCategory("email_provider_disabled"),
      );
    }
  });

  it("maps existing account without treating app invite as failed", () => {
    const mapped = mapAuthInviteError({
      message: "A user with this email address has already been registered",
      code: "email_exists",
    });
    expect(mapped).toEqual({ outcome: "existing_account" });
    const copy = coordinatorMessageForDelivery({
      deliveryStatus: "existing_account",
    });
    expect(copy.message).toContain("already have an account");
    expect(copy.warning).toContain("existing user");
  });

  it("maps email delivery failure to preserve-app-invite messaging", () => {
    const mapped = mapAuthInviteError({
      message: "Error sending invite email",
    });
    expect(mapped.outcome).toBe("failed");
    if (mapped.outcome === "failed") {
      expect(mapped.category).toBe("delivery_failed");
    }
    const copy = coordinatorMessageForDelivery({
      deliveryStatus: "failed",
      diagnostic: diagnosticForCategory("delivery_failed"),
    });
    expect(copy.message).toContain("could not be sent");
    expect(copy.message.toLowerCase()).not.toContain("failed to invite user");
  });

  it("never returns raw secrets or stack traces in diagnostics", () => {
    const mapped = mapAuthInviteError({
      message:
        "POST https://xyz.supabase.co/auth/v1/invite failed with apikey=secret Bearer token",
    });
    expect(mapped.outcome).toBe("failed");
    if (mapped.outcome === "failed") {
      expect(mapped.diagnostic.toLowerCase()).not.toContain("apikey");
      expect(mapped.diagnostic.toLowerCase()).not.toContain("bearer");
      expect(mapped.diagnostic.toLowerCase()).not.toContain("supabase.co");
    }
  });
});
