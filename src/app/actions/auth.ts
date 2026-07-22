"use server";

import { redirect } from "next/navigation";
import { evaluateRegistration } from "@/lib/auth/registration-policy";
import { buildAppAbsoluteUrl } from "@/lib/env/canonical-origin";
import { getServerEnv } from "@/lib/env/server";
import { normalizeEmail } from "@/lib/env/server-schema";
import { AppError, mapAuthError, toPublicErrorMessage } from "@/lib/errors";
import { resolveInviteToken } from "@/lib/invitations/resolve-token";
import { safeRedirectPath } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  authEmailPasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/validations/household";
import { hashInviteToken } from "@/lib/tokens";

export type ActionResult =
  | {
      ok: true;
      message?: string;
      warning?: string;
      data?: Record<string, string>;
    }
  | {
      ok: false;
      error: string;
      /** Optional recovery link (e.g. blocking submitted payment). */
      actionHref?: string;
      actionLabel?: string;
    };

/**
 * App registration must align with hook_before_user_created:
 * a pending non-expired invitation for the email (or a valid invite token) allows signup.
 */
async function hasValidInvitationForRegistration(
  email: string,
  inviteToken?: string | null,
): Promise<boolean> {
  const supabase = await createClient();
  const normalized = normalizeEmail(email);

  if (inviteToken) {
    const { data, error } = await supabase.rpc("get_invitation_preview", {
      p_token_hash: hashInviteToken(inviteToken),
    });
    if (!error) {
      const preview = Array.isArray(data) ? data[0] : data;
      if (preview?.status === "pending") {
        return true;
      }
    }
  }

  const { data: pending, error: pendingError } = await supabase.rpc(
    "has_pending_household_invitation",
    { p_email: normalized },
  );
  if (pendingError) {
    return false;
  }
  return pending === true;
}

export async function signUpAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = authEmailPasswordSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });
    if (!parsed.success) {
      return { ok: false, error: "Valid email and password (8+ characters) are required." };
    }

    const displayName = String(formData.get("displayName") ?? "").trim();
    const next = safeRedirectPath(String(formData.get("next") ?? ""), "/onboarding");
    const inviteToken = resolveInviteToken({
      invite: String(formData.get("inviteToken") ?? "").trim() || null,
      next,
    });

    const env = getServerEnv();
    const inviteOk = await hasValidInvitationForRegistration(
      parsed.data.email,
      inviteToken,
    );
    const decision = evaluateRegistration({
      mode: env.REGISTRATION_MODE,
      email: parsed.data.email,
      bootstrapEmail: env.BOOTSTRAP_EMAIL,
      hasValidInvitationMatchingEmail: inviteOk,
      appEnv: env.APP_ENV,
    });

    if (!decision.allowed) {
      return {
        ok: false,
        error: decision.reason,
        actionHref: "/join/paste",
        actionLabel: "Enter invitation link",
      };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { display_name: displayName || parsed.data.email.split("@")[0] },
        emailRedirectTo: buildAppAbsoluteUrl(
          `/auth/callback?next=${encodeURIComponent(next)}`,
          env.APP_URL,
        ),
      },
    });

    if (error) {
      return { ok: false, error: mapAuthError(error).publicMessage };
    }

    if (data.session) {
      await supabase.rpc("ensure_profile");
      if (inviteToken) {
        redirect(`/join/${inviteToken}`);
      }
      redirect(next);
    }

    return {
      ok: true,
      message:
        "Check your email to confirm your account before signing in.",
    };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

/**
 * @deprecated Password login uses POST /api/auth/sign-in (stable Route Handler).
 * Kept only for non-UI callers / transitional tests — do not wire to login forms.
 */
export async function signInAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  void formData;
  return {
    ok: false,
    error:
      "Password sign-in moved to a stable API route. Refresh the login page and try again.",
    actionHref: "/login",
    actionLabel: "Open login",
  };
}

export async function signOutAction(): Promise<void> {
  const { performEmergencyLogout } = await import("@/lib/recovery-actions");
  await performEmergencyLogout("/actions/signOutAction");
  redirect("/login?reason=signed_out");
}

export async function forgotPasswordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = forgotPasswordSchema.safeParse({
      email: formData.get("email"),
    });
    if (!parsed.success) {
      return { ok: false, error: "Enter a valid email address." };
    }

    const env = getServerEnv();
    const supabase = await createClient();
    // Always return the same message to avoid account enumeration.
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: buildAppAbsoluteUrl(
        `/auth/callback?next=${encodeURIComponent("/reset-password")}`,
        env.APP_URL,
      ),
    });

    return {
      ok: true,
      message:
        "If an account exists for that email, you will receive password reset instructions.",
    };
  } catch (error) {
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}

export async function resetPasswordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = resetPasswordSchema.safeParse({
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
    });
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid password.",
      };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new AppError(
        "authentication",
        "Your reset session expired. Request a new password reset link.",
      );
    }

    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });
    if (error) {
      return { ok: false, error: mapAuthError(error).publicMessage };
    }

    redirect("/app");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, error: toPublicErrorMessage(error) };
  }
}
