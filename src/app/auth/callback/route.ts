import { NextResponse } from "next/server";
import {
  classifyCallbackAuthError,
  isAllowedRecoveryNext,
} from "@/lib/auth/password-recovery";
import { getCanonicalAppOrigin } from "@/lib/env/canonical-origin";
import { safeRedirectPath } from "@/lib/navigation";
import { AUTH_NO_STORE_HEADERS } from "@/lib/security/sensitive-query";
import { createClient } from "@/lib/supabase/server";

function redirectWithHeaders(url: string): NextResponse {
  const res = NextResponse.redirect(url);
  for (const [key, value] of Object.entries(AUTH_NO_STORE_HEADERS)) {
    res.headers.set(key, value);
  }
  return res;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  let origin: string;
  try {
    origin = getCanonicalAppOrigin();
  } catch {
    // Fallback only when APP_URL misconfigured in non-prod — never trust Host blindly in prod.
    origin = new URL(request.url).origin;
  }

  const code = searchParams.get("code");
  const rawNext = safeRedirectPath(searchParams.get("next"), "/app");
  const next = isAllowedRecoveryNext(rawNext) ? rawNext : "/app";
  const errorDescription = searchParams.get("error_description");
  const errorCode = searchParams.get("error");

  if (errorCode || errorDescription) {
    const codeMapped = classifyCallbackAuthError(errorCode, errorDescription);
    return redirectWithHeaders(`${origin}/login?error=${codeMapped}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const blob = (error.message ?? "").toLowerCase();
      const mapped = classifyCallbackAuthError(error.code ?? null, error.message);
      // Prefer used/expired classification when exchange fails after a prior use.
      const finalCode =
        blob.includes("expired")
          ? "link_expired"
          : mapped === "auth_failed"
            ? "link_invalid"
            : mapped;
      return redirectWithHeaders(`${origin}/login?error=${finalCode}`);
    }
    await supabase.rpc("ensure_profile");
    return redirectWithHeaders(`${origin}${next}`);
  }

  return redirectWithHeaders(`${origin}/login?error=auth_failed`);
}
