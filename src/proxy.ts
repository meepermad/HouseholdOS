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
  "/api/auth/sign-in",
  "/join/",
  "/recovery",
];

/** Production aliases that should redirect to the canonical APP_URL host. */
const PRODUCTION_ALIAS_HOSTS = new Set([
  "household-os-meepermad.vercel.app",
]);

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

function canonicalRedirectIfNeeded(request: NextRequest): NextResponse | null {
  try {
    const appEnv = process.env.APP_ENV;
    const appUrl = process.env.APP_URL;
    if (appEnv !== "production" || !appUrl) return null;
    const canonical = new URL(appUrl);
    const host = request.nextUrl.hostname;
    if (host === canonical.hostname) return null;
    if (!PRODUCTION_ALIAS_HOSTS.has(host)) return null;
    const target = new URL(
      request.nextUrl.pathname + request.nextUrl.search,
      canonical.origin,
    );
    return NextResponse.redirect(target, 308);
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const canonical = canonicalRedirectIfNeeded(request);
  if (canonical) return canonical;

  const { response } = await updateSession(request);
  if (response.status >= 400) {
    return response;
  }

  const { pathname } = request.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) {
    return response;
  }

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
