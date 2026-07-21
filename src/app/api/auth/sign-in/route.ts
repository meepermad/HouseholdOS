import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/env/public";
import { getServerEnv } from "@/lib/env/server";
import { mapAuthError } from "@/lib/errors";
import { resolvePostAuthDestination } from "@/lib/auth/post-auth-destination";
import { isAllowedSignInOrigin } from "@/lib/auth/sign-in-origin";
import {
  detectSignInContentMode,
  mapSignInErrorMessage,
  parseFormUrlEncoded,
  signInErrorLoginPath,
  type SignInErrorCode,
} from "@/lib/auth/sign-in-request";
import { validateCurrentHouseholdSelection } from "@/lib/navigation";
import { safeRedirectPath } from "@/lib/navigation";
import { authEmailPasswordSchema } from "@/lib/validations/household";
import type { Database } from "@/types/database";

export const runtime = "nodejs";

const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimit(key: string, limit = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  const row = hits.get(key);
  if (!row || row.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (row.count >= limit) return false;
  row.count += 1;
  return true;
}

function clientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return `signin:${ip}`;
}

type SignInOk = { ok: true; redirectTo: string };
type SignInErr = {
  ok: false;
  error: string;
  category: SignInErrorCode;
  actionHref?: string;
  actionLabel?: string;
};

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

function jsonError(
  code: SignInErrorCode,
  status: number,
  extras?: Partial<SignInErr>,
  cookies: PendingCookie[] = [],
): NextResponse {
  const res = NextResponse.json(
    {
      ok: false,
      error: mapSignInErrorMessage(code),
      category: code,
      ...extras,
    } satisfies SignInErr,
    { status },
  );
  applyCookies(res, cookies);
  return res;
}

function formRedirect(
  absoluteOrPath: string,
  requestUrl: string,
  cookies: PendingCookie[],
): NextResponse {
  const location = absoluteOrPath.startsWith("http")
    ? absoluteOrPath
    : new URL(absoluteOrPath, requestUrl).toString();
  const res = NextResponse.redirect(location, 303);
  applyCookies(res, cookies);
  return res;
}

export async function POST(request: NextRequest) {
  const mode = detectSignInContentMode(request.headers.get("content-type"));
  const preferForm =
    mode === "form" ||
    (mode === "unsupported" &&
      !(request.headers.get("accept") ?? "").includes("application/json"));

  const fail = (code: SignInErrorCode, status: number, cookies: PendingCookie[] = []) => {
    if (preferForm) {
      return formRedirect(signInErrorLoginPath(code), request.url, cookies);
    }
    return jsonError(code, status, undefined, cookies);
  };

  if (mode === "unsupported") {
    return fail("unsupported", 415);
  }

  const env = getServerEnv();
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  if (!isAllowedSignInOrigin(origin, env.APP_URL, request.url, referer)) {
    return fail("origin", 403);
  }

  if (!rateLimit(clientKey(request))) {
    return fail("rate_limit", 429);
  }

  let record: Record<string, unknown> = {};
  try {
    const text = await request.text();
    if (text.length > 8_192) {
      return fail("validation", 413);
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
    return fail("validation", 400);
  }

  const parsed = authEmailPasswordSchema.safeParse({
    email: record.email,
    password: record.password,
  });
  if (!parsed.success) {
    return fail("validation", 400);
  }

  const requestedNext = safeRedirectPath(
    typeof record.next === "string" ? record.next : "/app",
    "/app",
  );

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

  const { data: signInData, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    // Map to safe code only — never include Supabase message in Location.
    void mapAuthError(error);
    return fail("invalid_credentials", 401);
  }

  const { error: profileError } = await supabase.rpc("ensure_profile");
  if (profileError) {
    if (mode === "form") {
      return formRedirect(
        "/login?error=profile",
        request.url,
        pendingCookies,
      );
    }
    return jsonError(
      "profile",
      503,
      {
        actionHref: "/recovery",
        actionLabel: "Open recovery",
      },
      pendingCookies,
    );
  }

  const userId = signInData.user?.id;
  let redirectTo = requestedNext;
  if (userId) {
    const { data: memberships } = await supabase
      .from("household_memberships")
      .select("household_id")
      .eq("user_id", userId)
      .eq("status", "active");
    const authorized = (memberships ?? []).map((row) => row.household_id);

    const { data: prefs } = await supabase
      .from("user_preferences")
      .select("current_household_id")
      .eq("user_id", userId)
      .maybeSingle();
    const preferred = validateCurrentHouseholdSelection({
      requestedId: prefs?.current_household_id,
      authorizedHouseholdIds: authorized,
    });

    redirectTo = resolvePostAuthDestination({
      requestedNext,
      authorizedHouseholdIds: authorized,
      preferredHouseholdId: preferred,
    });
  }

  if (mode === "form") {
    return formRedirect(redirectTo, request.url, pendingCookies);
  }

  const payload: SignInOk = { ok: true, redirectTo };
  const res = NextResponse.json(payload, { status: 200 });
  applyCookies(res, pendingCookies);
  return res;
}
