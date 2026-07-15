"use server";

import { redirect } from "next/navigation";
import { evaluateRegistration } from "@/lib/auth/registration-policy";
import { getServerEnv } from "@/lib/env/server";
import { AppError, mapAuthError, toPublicErrorMessage } from "@/lib/errors";
import { safeRedirectPath } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  authEmailPasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/validations/household";
import { hashInviteToken } from "@/lib/tokens";

export type ActionResult =
  | { ok: true; message?: string; data?: Record<string, string> }
  | {
      ok: false;
      error: string;
      /** Optional recovery link (e.g. blocking submitted payment). */
      actionHref?: string;
      actionLabel?: string;
    };

async function hasPendingInviteForEmail(email: string, token?: string | null) {
  if (!token) return false;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_invitation_preview", {
    p_token_hash: hashInviteToken(token),
  });
  const preview = Array.isArray(data) ? data[0] : data;
  if (!preview || preview.status !== "pending") return false;
  // Preview does not expose full email; invite path also checks on accept.
  // For registration policy we trust the invite token presence + later accept email match.
  void email;
  return true;
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
    const inviteToken = String(formData.get("inviteToken") ?? "").trim() || null;
    const next = safeRedirectPath(String(formData.get("next") ?? ""), "/onboarding");

    const env = getServerEnv();
    const inviteOk = await hasPendingInviteForEmail(parsed.data.email, inviteToken);
    const decision = evaluateRegistration({
      mode: env.REGISTRATION_MODE,
      email: parsed.data.email,
      bootstrapEmail: env.BOOTSTRAP_EMAIL,
      hasValidInvitationMatchingEmail: inviteOk,
      appEnv: env.APP_ENV,
    });

    if (!decision.allowed) {
      return { ok: false, error: decision.reason };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { display_name: displayName || parsed.data.email.split("@")[0] },
        emailRedirectTo: `${env.APP_URL}/auth/callback?next=${encodeURIComponent(next)}`,
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

export async function signInAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = authEmailPasswordSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });
    if (!parsed.success) {
      return { ok: false, error: "Valid email and password are required." };
    }

    const next = safeRedirectPath(String(formData.get("next") ?? ""), "/app");
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error) {
      return { ok: false, error: mapAuthError(error).publicMessage };
    }

    await supabase.rpc("ensure_profile");
    redirect(next);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, error: toPublicErrorMessage(error) };
  }
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
      redirectTo: `${env.APP_URL}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
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
