import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowedSignInOrigin } from "@/lib/auth/sign-in-origin";
import { clientIpKey, rateLimit } from "@/lib/auth/rate-limit";
import { mapRecoveryAuthErrorMessage } from "@/lib/auth/password-recovery";
import {
  detectSignInContentMode,
  parseFormUrlEncoded,
} from "@/lib/auth/sign-in-request";
import { getPublicEnv } from "@/lib/env/public";
import { getServerEnv } from "@/lib/env/server";
import { mapAuthError } from "@/lib/errors";
import { resetPasswordSchema } from "@/lib/validations/household";
import type { Database } from "@/types/database";

export const runtime = "nodejs";

type PendingCookie = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

function applyCookies(res: NextResponse, cookies: PendingCookie[]) {
  cookies.forEach(({ name, value, options }) => {
    res.cookies.set(name, value, options);
  });
}

function formRedirect(
  path: string,
  requestUrl: string,
  cookies: PendingCookie[] = [],
): NextResponse {
  const res = NextResponse.redirect(new URL(path, requestUrl), 303);
  applyCookies(res, cookies);
  return res;
}

export async function POST(request: NextRequest) {
  const mode = detectSignInContentMode(request.headers.get("content-type"));
  const preferForm =
    mode === "form" ||
    (mode === "unsupported" &&
      !(request.headers.get("accept") ?? "").includes("application/json"));

  const env = getServerEnv();
  if (
    !isAllowedSignInOrigin(
      request.headers.get("origin"),
      env.APP_URL,
      request.url,
      request.headers.get("referer"),
      request.headers.get("sec-fetch-site"),
    )
  ) {
    if (preferForm) {
      return formRedirect("/reset-password?error=origin", request.url);
    }
    return NextResponse.json(
      { ok: false, error: mapRecoveryAuthErrorMessage("origin") },
      { status: 403 },
    );
  }

  if (!rateLimit(clientIpKey("reset", request), 10, 60_000)) {
    if (preferForm) {
      return formRedirect("/reset-password?error=rate_limit", request.url);
    }
    return NextResponse.json(
      { ok: false, error: mapRecoveryAuthErrorMessage("rate_limit") },
      { status: 429 },
    );
  }

  let record: Record<string, unknown> = {};
  try {
    const text = await request.text();
    if (text.length > 4_096) {
      if (preferForm) {
        return formRedirect("/reset-password?error=validation", request.url);
      }
      return NextResponse.json(
        { ok: false, error: mapRecoveryAuthErrorMessage("weak_password") },
        { status: 413 },
      );
    }
    if (mode === "json") {
      const parsedJson = text ? (JSON.parse(text) as unknown) : {};
      record =
        parsedJson && typeof parsedJson === "object"
          ? (parsedJson as Record<string, unknown>)
          : {};
    } else {
      record = parseFormUrlEncoded(text);
    }
  } catch {
    if (preferForm) {
      return formRedirect("/reset-password?error=validation", request.url);
    }
    return NextResponse.json(
      { ok: false, error: mapRecoveryAuthErrorMessage("validation") },
      { status: 400 },
    );
  }

  const parsed = resetPasswordSchema.safeParse({
    password: record.password,
    confirmPassword: record.confirmPassword,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const code =
      issue?.path?.[0] === "confirmPassword" ||
      issue?.message?.toLowerCase().includes("match")
        ? "mismatch"
        : "weak_password";
    if (preferForm) {
      return formRedirect(`/reset-password?error=${code}`, request.url);
    }
    return NextResponse.json(
      { ok: false, error: mapRecoveryAuthErrorMessage(code), category: code },
      { status: 400 },
    );
  }

  const publicEnv = getPublicEnv();
  const pendingCookies: PendingCookie[] = [];

  const supabase = createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            pendingCookies.push({ name, value, options });
            request.cookies.set(name, value);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    if (preferForm) {
      return formRedirect("/login?error=session_expired", request.url, pendingCookies);
    }
    return NextResponse.json(
      { ok: false, error: mapRecoveryAuthErrorMessage("session_expired") },
      { status: 401 },
    );
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    void mapAuthError(error);
    const msg = (error.message ?? "").toLowerCase();
    const code = msg.includes("weak") || msg.includes("least")
      ? "weak_password"
      : "auth_failed";
    if (preferForm) {
      return formRedirect(`/reset-password?error=${code}`, request.url, pendingCookies);
    }
    return NextResponse.json(
      { ok: false, error: mapRecoveryAuthErrorMessage(code) },
      { status: 400 },
    );
  }

  // End recovery session so the user must sign in with the new password.
  // Prefer global sign-out; fall back to local if scope unsupported.
  try {
    await supabase.auth.signOut({ scope: "global" });
  } catch {
    await supabase.auth.signOut();
  }

  if (preferForm) {
    return formRedirect("/login?error=password_updated", request.url, pendingCookies);
  }
  return NextResponse.json(
    {
      ok: true,
      message: mapRecoveryAuthErrorMessage("password_updated"),
      redirectTo: "/login?error=password_updated",
    },
    { status: 200 },
  );
}
