import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ConfigurationError, parsePublicEnv } from "@/lib/env/public";
import {
  isRefreshTokenRaceError,
  isRevokedRefreshTokenError,
} from "@/lib/supabase/auth-errors";
import type { Database } from "@/types/database";
import type { User } from "@supabase/supabase-js";

export type SessionUpdateResult = {
  response: NextResponse;
  user: User | null;
};

function clearSupabaseAuthCookies(
  request: NextRequest,
  response: NextResponse,
) {
  for (const { name } of request.cookies.getAll()) {
    if (!(name.startsWith("sb-") || name.includes("auth-token"))) continue;
    request.cookies.delete(name);
    response.cookies.set(name, "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
}

export async function updateSession(
  request: NextRequest,
): Promise<SessionUpdateResult> {
  let supabaseResponse = NextResponse.next({ request });

  let url: string;
  let publishableKey: string;
  try {
    const env = parsePublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    });
    url = env.NEXT_PUBLIC_SUPABASE_URL;
    publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return {
        response: new NextResponse(error.message, { status: 500 }),
        user: null,
      };
    }
    throw error;
  }

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  let {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Parallel middleware/RSC refreshes can lose the single-use token race.
  // Retry once before treating the session as gone.
  if (
    error &&
    (isRefreshTokenRaceError(error) || isRevokedRefreshTokenError(error))
  ) {
    const retry = await supabase.auth.getUser();
    user = retry.data.user;
    error = retry.error;
  }

  if (error && isRefreshTokenRaceError(error)) {
    // Winner of the race may have already rotated cookies on another response.
    // Do not wipe — that causes login ↔ /app bounce with a stuck pending form.
    return { response: supabaseResponse, user: user ?? null };
  }

  if (error && isRevokedRefreshTokenError(error) && !user) {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Cookie wipe below is the reliable fallback.
    }
    clearSupabaseAuthCookies(request, supabaseResponse);
    return { response: supabaseResponse, user: null };
  }

  return { response: supabaseResponse, user: user ?? null };
}
