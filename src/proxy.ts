import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { safeRedirectPath } from "@/lib/navigation";

const AUTH_PAGES = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
]);

const PUBLIC_PREFIXES = [
  "/auth/callback",
  "/auth/logout",
  "/auth/clear-household",
  "/api/health",
  "/api/ready",
  "/join/",
  "/recovery",
];

function withSessionCookies(
  from: NextResponse,
  to: NextResponse,
): NextResponse {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
  return to;
}

function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((c) => c.name.includes("auth-token") || c.name.startsWith("sb-"));
}

export async function proxy(request: NextRequest) {
  const { response } = await updateSession(request);
  if (response.status >= 400) {
    return response;
  }

  const { pathname } = request.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) {
    return response;
  }

  // Dev-only error trigger stays reachable without auth in non-production.
  if (
    pathname.startsWith("/dev/") &&
    process.env.NODE_ENV !== "production" &&
    process.env.APP_ENV !== "production"
  ) {
    return response;
  }

  const isAuthPage = AUTH_PAGES.has(pathname);
  const isProtected =
    pathname.startsWith("/app") ||
    pathname.startsWith("/onboarding") ||
    pathname === "/";

  // Gate on cookie presence, not getUser(), so a refresh-token race cannot
  // bounce login ↔ /app while the client is stuck on “Signing in…”.
  const hasAuthCookie = hasSupabaseAuthCookie(request);

  if (isProtected && !hasAuthCookie && pathname !== "/") {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", safeRedirectPath(pathname));
    return withSessionCookies(response, NextResponse.redirect(login));
  }

  if (isAuthPage && hasAuthCookie && pathname !== "/reset-password") {
    // Defer to page-level getUser() so expired cookies are not forced into /app.
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
