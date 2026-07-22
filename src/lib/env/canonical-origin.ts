import "server-only";

import { ConfigurationError } from "@/lib/env/public";

export type AppRuntimeEnv = "development" | "test" | "production";

const DEV_FALLBACK_ORIGIN = "http://localhost:3000";

const PRODUCTION_ORIGIN_MISCONFIG =
  "Invitation links are not configured for production. Set APP_URL and redeploy.";

export class InvitationOriginConfigurationError extends ConfigurationError {
  constructor(message: string = PRODUCTION_ORIGIN_MISCONFIG) {
    super(message);
    this.name = "InvitationOriginConfigurationError";
  }
}

/** Resolve runtime env; treat Vercel production as production even if APP_ENV is unset. */
export function resolveAppRuntimeEnv(
  source: Record<string, string | undefined> = process.env,
): AppRuntimeEnv {
  const explicit = source.APP_ENV?.trim();
  if (explicit === "production" || explicit === "test" || explicit === "development") {
    return explicit;
  }
  if (source.VERCEL_ENV === "production") return "production";
  if (source.NODE_ENV === "test" || source.VITEST === "true") return "test";
  return "development";
}

function isLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host === "::1"
  );
}

/**
 * Validate and normalize an absolute origin (scheme + host[:port] only).
 * Strips trailing slashes; rejects credentials, paths, query, and fragments.
 */
export function normalizeCanonicalOrigin(
  raw: string,
  options: { requireHttps: boolean; allowLocalhost: boolean },
): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new InvitationOriginConfigurationError(
      "APP_URL is empty. Set APP_URL to the canonical application origin.",
    );
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new InvitationOriginConfigurationError(
      "APP_URL must be a valid absolute URL (e.g. https://household-os-five.vercel.app).",
    );
  }

  if (url.username || url.password) {
    throw new InvitationOriginConfigurationError(
      "APP_URL must not include credentials.",
    );
  }

  if (url.search || url.hash) {
    throw new InvitationOriginConfigurationError(
      "APP_URL must be an origin only (no query string or fragment).",
    );
  }

  // `https://example.com` and `https://example.com/` both parse pathname as `/`.
  if (url.pathname !== "/" && url.pathname !== "") {
    throw new InvitationOriginConfigurationError(
      "APP_URL must be an origin only (no path). Example: https://household-os-five.vercel.app",
    );
  }

  if (options.requireHttps && url.protocol !== "https:") {
    throw new InvitationOriginConfigurationError(
      "APP_URL must use https in production.",
    );
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new InvitationOriginConfigurationError(
      "APP_URL must use http or https.",
    );
  }

  if (!options.allowLocalhost && isLocalHostname(url.hostname)) {
    throw new InvitationOriginConfigurationError(PRODUCTION_ORIGIN_MISCONFIG);
  }

  return url.origin;
}

function previewOriginFromVercelUrl(vercelUrl: string): string {
  const host = vercelUrl.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  if (!host) {
    throw new InvitationOriginConfigurationError(
      "VERCEL_URL is empty; set APP_URL for this preview deployment.",
    );
  }
  return normalizeCanonicalOrigin(`https://${host}`, {
    requireHttps: true,
    allowLocalhost: false,
  });
}

export type CanonicalOriginInput = {
  APP_URL?: string;
  APP_ENV?: string;
  VERCEL_ENV?: string;
  VERCEL_URL?: string;
  NODE_ENV?: string;
  VITEST?: string;
};

/**
 * Server-only canonical application origin for invitation links and auth redirects.
 * Never trusts Host / X-Forwarded-Host. Never silently falls back to localhost in production.
 */
export function getCanonicalAppOrigin(
  source: CanonicalOriginInput = process.env,
): string {
  const runtime = resolveAppRuntimeEnv(source);
  const explicit = typeof source.APP_URL === "string" ? source.APP_URL.trim() : "";

  if (runtime === "production") {
    if (!explicit) {
      throw new InvitationOriginConfigurationError(PRODUCTION_ORIGIN_MISCONFIG);
    }
    return normalizeCanonicalOrigin(explicit, {
      requireHttps: true,
      allowLocalhost: false,
    });
  }

  if (explicit) {
    return normalizeCanonicalOrigin(explicit, {
      requireHttps: false,
      allowLocalhost: true,
    });
  }

  // Preview deployments: prefer explicit APP_URL; otherwise https://VERCEL_URL.
  if (source.VERCEL_ENV === "preview" && source.VERCEL_URL) {
    return previewOriginFromVercelUrl(source.VERCEL_URL);
  }

  if (runtime === "development" || runtime === "test") {
    return DEV_FALLBACK_ORIGIN;
  }

  throw new InvitationOriginConfigurationError(PRODUCTION_ORIGIN_MISCONFIG);
}

/** Build an absolute join URL without double-slash or Host-header trust. */
export function buildInvitationJoinUrl(
  token: string,
  origin: string = getCanonicalAppOrigin(),
): string {
  return new URL(`/join/${token}`, origin).toString();
}

/** Build an absolute create-household registration URL from the canonical origin. */
export function buildCreateHouseholdRegistrationUrl(
  token: string,
  origin: string = getCanonicalAppOrigin(),
): string {
  return new URL(`/register/create-household/${token}`, origin).toString();
}

export function buildAppAbsoluteUrl(
  path: string,
  origin: string = getCanonicalAppOrigin(),
): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, origin).toString();
}

/** Safe readiness fields — never includes secrets or tokens. */
export function getInvitationOriginReadiness(
  source: CanonicalOriginInput = process.env,
): {
  invitation_origin_configured: boolean;
  invitation_origin_host: string | null;
  invitation_origin_https: boolean;
} {
  try {
    const origin = getCanonicalAppOrigin(source);
    const url = new URL(origin);
    const runtime = resolveAppRuntimeEnv(source);
    const invitation_origin_configured =
      runtime === "production"
        ? Boolean(source.APP_URL?.trim()) &&
          url.protocol === "https:" &&
          !isLocalHostname(url.hostname)
        : true;
    return {
      invitation_origin_configured,
      invitation_origin_host: url.hostname,
      invitation_origin_https: url.protocol === "https:",
    };
  } catch {
    return {
      invitation_origin_configured: false,
      invitation_origin_host: null,
      invitation_origin_https: false,
    };
  }
}

export { PRODUCTION_ORIGIN_MISCONFIG };
