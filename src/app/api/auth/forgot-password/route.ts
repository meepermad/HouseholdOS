import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowedSignInOrigin } from "@/lib/auth/sign-in-origin";
import { clientIpKey, rateLimit } from "@/lib/auth/rate-limit";
import {
  GENERIC_FORGOT_SUCCESS,
  mapRecoveryAuthErrorMessage,
} from "@/lib/auth/password-recovery";
import { detectSignInContentMode, parseFormUrlEncoded } from "@/lib/auth/sign-in-request";
import { buildAppAbsoluteUrl } from "@/lib/env/canonical-origin";
import { getServerEnv } from "@/lib/env/server";
import { forgotPasswordSchema } from "@/lib/validations/household";

export const runtime = "nodejs";

function formRedirect(path: string, requestUrl: string): NextResponse {
  return NextResponse.redirect(new URL(path, requestUrl), 303);
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
      return formRedirect("/forgot-password?error=origin", request.url);
    }
    return NextResponse.json(
      { ok: false, error: mapRecoveryAuthErrorMessage("origin"), category: "origin" },
      { status: 403 },
    );
  }

  if (!rateLimit(clientIpKey("forgot", request), 10, 60_000)) {
    if (preferForm) {
      return formRedirect("/forgot-password?error=rate_limit", request.url);
    }
    return NextResponse.json(
      {
        ok: false,
        error: mapRecoveryAuthErrorMessage("rate_limit"),
        category: "rate_limit",
      },
      { status: 429 },
    );
  }

  let record: Record<string, unknown> = {};
  try {
    const text = await request.text();
    if (text.length > 4_096) {
      if (preferForm) {
        return formRedirect("/forgot-password?error=validation", request.url);
      }
      return NextResponse.json(
        { ok: false, error: mapRecoveryAuthErrorMessage("validation") },
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
      return formRedirect("/forgot-password?error=validation", request.url);
    }
    return NextResponse.json(
      { ok: false, error: mapRecoveryAuthErrorMessage("validation") },
      { status: 400 },
    );
  }

  const parsed = forgotPasswordSchema.safeParse({ email: record.email });
  if (!parsed.success) {
    if (preferForm) {
      return formRedirect("/forgot-password?error=validation", request.url);
    }
    return NextResponse.json(
      { ok: false, error: mapRecoveryAuthErrorMessage("validation") },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  // Always succeed publicly — do not reveal whether the account exists.
  try {
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: buildAppAbsoluteUrl(
        `/auth/callback?next=${encodeURIComponent("/reset-password")}`,
        env.APP_URL,
      ),
    });
  } catch {
    // Swallow — generic response either way.
  }
  // Ignore { error } from Supabase — never enumerate accounts.

  if (preferForm) {
    return formRedirect("/forgot-password?sent=1", request.url);
  }
  return NextResponse.json({ ok: true, message: GENERIC_FORGOT_SUCCESS });
}
