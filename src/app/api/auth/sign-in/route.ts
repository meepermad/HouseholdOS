import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/env/public";
import { getServerEnv } from "@/lib/env/server";
import { mapAuthError } from "@/lib/errors";
import { resolvePostAuthDestination } from "@/lib/auth/post-auth-destination";
import { isAllowedSignInOrigin } from "@/lib/auth/sign-in-origin";
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
  category:
    | "validation"
    | "auth"
    | "profile"
    | "rate_limit"
    | "origin"
    | "server";
  actionHref?: string;
  actionLabel?: string;
};

export async function POST(request: NextRequest) {
  const env = getServerEnv();
  const origin = request.headers.get("origin");
  if (!isAllowedSignInOrigin(origin, env.APP_URL, request.url)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Sign-in request origin was rejected.",
        category: "origin",
      } satisfies SignInErr,
      { status: 403 },
    );
  }

  if (!rateLimit(clientKey(request))) {
    return NextResponse.json(
      {
        ok: false,
        error: "Too many sign-in attempts. Wait a minute and try again.",
        category: "rate_limit",
      } satisfies SignInErr,
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 8_192) {
      return NextResponse.json(
        {
          ok: false,
          error: "Request is too large.",
          category: "validation",
        } satisfies SignInErr,
        { status: 413 },
      );
    }
    body = text ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid sign-in payload.",
        category: "validation",
      } satisfies SignInErr,
      { status: 400 },
    );
  }

  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const parsed = authEmailPasswordSchema.safeParse({
    email: record.email,
    password: record.password,
  });
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Valid email and password are required.",
        category: "validation",
      } satisfies SignInErr,
      { status: 400 },
    );
  }

  const requestedNext = safeRedirectPath(
    typeof record.next === "string" ? record.next : "/app",
    "/app",
  );

  const publicEnv = getPublicEnv();
  const pendingCookies: {
    name: string;
    value: string;
    options?: Parameters<NextResponse["cookies"]["set"]>[2];
  }[] = [];

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
            // Keep in-request cookie view current for follow-up queries.
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
    return NextResponse.json(
      {
        ok: false,
        error: mapAuthError(error).publicMessage,
        category: "auth",
      } satisfies SignInErr,
      { status: 401 },
    );
  }

  const { error: profileError } = await supabase.rpc("ensure_profile");
  if (profileError) {
    const res = NextResponse.json(
      {
        ok: false,
        error:
          "Signed in, but your profile could not be initialized. Open recovery or try again.",
        category: "profile",
        actionHref: "/recovery",
        actionLabel: "Open recovery",
      } satisfies SignInErr,
      { status: 503 },
    );
    pendingCookies.forEach(({ name, value, options }) => {
      res.cookies.set(name, value, options);
    });
    return res;
  }

  const userId = signInData.user?.id;
  let redirectTo = requestedNext;
  if (userId) {
    // Use the same authenticated client — do not open a fresh cookie store.
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

  const payload: SignInOk = { ok: true, redirectTo };
  const res = NextResponse.json(payload, { status: 200 });
  pendingCookies.forEach(({ name, value, options }) => {
    res.cookies.set(name, value, options);
  });
  return res;
}
