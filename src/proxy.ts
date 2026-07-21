import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { safeRedirectPath } from "@/lib/navigation";
import {
  AUTH_NO_STORE_HEADERS,
  buildCleanAuthUrl,
  isAuthCleanupPath,
  urlHasSensitiveQueryKeys,
} from "@/lib/security/sensitive-query";
import {
  buildContentSecurityPolicy,
  createCspNonce,
} from "@/lib/security/csp";
import { getServerBuildInfo } from "@/lib/build-info";

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

function supabaseOriginFromEnv(): string {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return url ? new URL(url).origin : "";
  } catch {
    return "";
  }
}

function withAuthPageHeaders(res: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(AUTH_NO_STORE_HEADERS)) {
    res.headers.set(key, value);
  }
  return res;
}

function withSecurityHeaders(
  response: NextResponse,
  csp: string,
): NextResponse {
  response.headers.set("Content-Security-Policy", csp);
  const build = getServerBuildInfo();
  response.headers.set("X-HouseholdOS-Build", build.commitSha);
  response.headers.set("X-HouseholdOS-Deployment", build.deploymentId);
  return response;
}

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

/**
 * Strip denylisted query keys without reading values.
 * Runs before alias redirect so secrets are never forwarded.
 */
function sensitiveQueryCleanupIfNeeded(
  request: NextRequest,
): NextResponse | null {
  const { pathname } = request.nextUrl;
  if (!isAuthCleanupPath(pathname)) return null;
  if (!urlHasSensitiveQueryKeys(request.nextUrl.searchParams)) return null;

  const clean = buildCleanAuthUrl(
    request.nextUrl.origin,
    pathname,
    request.nextUrl.searchParams,
  );
  return withAuthPageHeaders(NextResponse.redirect(clean, 303));
}

function sanitizedSearchForCanonical(searchParams: URLSearchParams): string {
  if (!urlHasSensitiveQueryKeys(searchParams)) {
    return searchParams.toString() ? `?${searchParams.toString()}` : "";
  }
  // Never forward sensitive keys across hosts; keep next + invite token.
  const next = new URLSearchParams();
  const nextRaw = searchParams.get("next");
  if (nextRaw) {
    next.set("next", safeRedirectPath(nextRaw, "/app"));
  }
  const invite = searchParams.get("invite")?.trim() ?? "";
  if (/^[A-Za-z0-9_-]{32,128}$/.test(invite)) {
    next.set("invite", invite);
  }
  next.set("reason", "cleared_sensitive_query");
  return `?${next.toString()}`;
}

function canonicalRedirectIfNeeded(request: NextRequest): NextResponse | null {
  try {
    // Never cross-host redirect auth API POSTs — that can null the Origin and
    // break sign-in (308 from alias → canonical).
    const { pathname } = request.nextUrl;
    if (pathname.startsWith("/api/")) return null;

    const appEnv = process.env.APP_ENV;
    const appUrl = process.env.APP_URL;
    if (appEnv !== "production" || !appUrl) return null;
    const canonical = new URL(appUrl);
    const host = request.nextUrl.hostname;
    if (host === canonical.hostname) return null;
    if (!PRODUCTION_ALIAS_HOSTS.has(host)) return null;
    const search = sanitizedSearchForCanonical(request.nextUrl.searchParams);
    const target = new URL(
      request.nextUrl.pathname + search,
      canonical.origin,
    );
    return withAuthPageHeaders(NextResponse.redirect(target, 308));
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const nonce = createCspNonce();
  const csp = buildContentSecurityPolicy({
    nonce,
    supabaseOrigin: supabaseOriginFromEnv(),
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next.js reads the nonce from the request CSP header during SSR.
  requestHeaders.set("Content-Security-Policy", csp);

  const cleanup = sensitiveQueryCleanupIfNeeded(request);
  if (cleanup) return withSecurityHeaders(cleanup, csp);

  const canonical = canonicalRedirectIfNeeded(request);
  if (canonical) return withSecurityHeaders(canonical, csp);

  const { response } = await updateSession(request, { requestHeaders });
  withSecurityHeaders(response, csp);
  if (response.status >= 400) {
    return response;
  }

  const { pathname } = request.nextUrl;

  if (isAuthCleanupPath(pathname) || AUTH_PAGES.has(pathname)) {
    withAuthPageHeaders(response);
  }

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
    return withSessionCookies(
      response,
      withSecurityHeaders(
        withAuthPageHeaders(NextResponse.redirect(login)),
        csp,
      ),
    );
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
