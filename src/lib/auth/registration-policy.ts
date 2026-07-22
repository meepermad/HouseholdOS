import type { RegistrationMode } from "@/lib/env/server-schema";
import { normalizeEmail } from "@/lib/env/server-schema";
import { AppError } from "@/lib/errors";

export type RegistrationDecision =
  | { allowed: true }
  | { allowed: false; reason: string; code: AppError["code"] };

export function evaluateRegistration(params: {
  mode: RegistrationMode;
  email: string;
  bootstrapEmail?: string;
  hasValidInvitationMatchingEmail: boolean;
  appEnv: "development" | "test" | "production";
}): RegistrationDecision {
  const email = normalizeEmail(params.email);

  if (params.mode === "open") {
    if (params.appEnv === "production") {
      return {
        allowed: false,
        reason: "Open registration is not available.",
        code: "authorization",
      };
    }
    return { allowed: true };
  }

  if (params.mode === "bootstrap_only") {
    const bootstrap = params.bootstrapEmail
      ? normalizeEmail(params.bootstrapEmail)
      : undefined;
    if (!bootstrap) {
      return {
        allowed: false,
        reason: "Bootstrap registration is not configured.",
        code: "missing_configuration",
      };
    }
    if (email === bootstrap) {
      return { allowed: true };
    }
    if (params.hasValidInvitationMatchingEmail) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: "Registration is limited to the bootstrap account or a valid invitation.",
      code: "authorization",
    };
  }

  // invite_only
  if (params.hasValidInvitationMatchingEmail) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason:
      "A valid household or independent-household registration invitation is required to register.",
    code: "authorization",
  };
}
