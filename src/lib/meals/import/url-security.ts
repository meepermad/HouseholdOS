import "server-only";

/**
 * Phase 6.6 — recipe import URL security (SSRF hardening).
 *
 * Validates a user-supplied recipe URL before any network access:
 *  - only http/https,
 *  - no embedded credentials,
 *  - no localhost / internal service names,
 *  - no private / reserved IPv4 or IPv6 ranges,
 *  - DNS-resolves every address and requires them all to be public.
 *
 * It returns a "pinned" address so the caller can connect directly to a
 * validated IP while still presenting the correct Host header / TLS SNI —
 * closing the DNS-rebinding window between validation and connection.
 *
 * Also defines the typed {@link ImportFailure} error used across the import
 * pipeline. Categories mirror `recipe_import_drafts.failure_category` in
 * migration 20260722010000_recipe_import.sql so they can be persisted verbatim.
 */

import net from "node:net";
import { promises as dns } from "node:dns";

import { redactUrlForLog } from "./log-redaction";

/** Failure categories, aligned with the DB `failure_category` check constraint. */
export const IMPORT_FAILURE_CATEGORIES = [
  "invalid_url",
  "blocked_destination",
  "robots_disallowed",
  "fetch_timeout",
  "response_too_large",
  "unsupported_content_type",
  "http_error",
  "rate_limited",
  "no_recipe_found",
  "multiple_recipes_found",
  "invalid_structured_data",
  "parser_failure",
  "login_required",
  "paywall_or_access_denied",
] as const;

export type ImportFailureCategory = (typeof IMPORT_FAILURE_CATEGORIES)[number];

export type ImportFailureOptions = {
  /** Redacted URL safe for logs (protocol/host/path only). */
  redactedUrl?: string;
  /** Upstream HTTP status, when the failure came from a response. */
  httpStatus?: number;
  /** Hint that a later manual retry might succeed (we never auto-retry). */
  retryable?: boolean;
  cause?: unknown;
};

/**
 * Typed error for every stage of recipe import. `category` is safe to persist
 * and to branch on; `message` is developer-facing and must not be shown raw to
 * end users if it could contain a full URL.
 */
export class ImportFailure extends Error {
  readonly category: ImportFailureCategory;
  readonly redactedUrl?: string;
  readonly httpStatus?: number;
  readonly retryable: boolean;

  constructor(
    category: ImportFailureCategory,
    message: string,
    options: ImportFailureOptions = {},
  ) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "ImportFailure";
    this.category = category;
    this.redactedUrl = options.redactedUrl;
    this.httpStatus = options.httpStatus;
    this.retryable = options.retryable ?? false;
  }
}

export function isImportFailure(value: unknown): value is ImportFailure {
  return value instanceof ImportFailure;
}

export type ResolvedAddress = { address: string; family: 4 | 6 };

export type ValidatedTarget = {
  /** Normalized URL that passed validation. */
  url: URL;
  protocol: "http:" | "https:";
  /** Lowercased hostname with any IPv6 brackets stripped. */
  hostname: string;
  port: number;
  /** All resolved public addresses (or the single literal IP). */
  addresses: ResolvedAddress[];
  /** Address the caller should connect to (pin to prevent rebinding). */
  pinnedAddress: string;
  pinnedFamily: 4 | 6;
  /** Value to send in the Host header / use for TLS SNI. */
  hostHeader: string;
};

/** Hostname suffixes that always indicate an internal / non-public target. */
const BLOCKED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".intranet",
  ".lan",
  ".home",
  ".corp",
  ".localdomain",
];

const BLOCKED_HOST_EXACT = new Set([
  "localhost",
  "ip6-localhost",
  "ip6-loopback",
]);

function stripBrackets(host: string): string {
  return host.startsWith("[") && host.endsWith("]")
    ? host.slice(1, -1)
    : host;
}

/** Parse a dotted-quad IPv4 string into 4 bytes, or null if malformed. */
function ipv4ToBytes(input: string): number[] | null {
  const parts = input.split(".");
  if (parts.length !== 4) return null;
  const bytes: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    bytes.push(n);
  }
  return bytes;
}

/** Parse an IPv6 string (incl. `::` and embedded IPv4) into 16 bytes, or null. */
function ipv6ToBytes(input: string): number[] | null {
  const s = input.split("%")[0]; // drop zone id
  if (!s) return null;

  const doubleColon = s.indexOf("::");
  let headPart: string;
  let tailPart: string;
  let hasDouble: boolean;
  if (doubleColon === -1) {
    hasDouble = false;
    headPart = s;
    tailPart = "";
  } else {
    if (s.indexOf("::", doubleColon + 1) !== -1) return null; // multiple "::"
    hasDouble = true;
    headPart = s.slice(0, doubleColon);
    tailPart = s.slice(doubleColon + 2);
  }

  const expand = (part: string): number[] | null => {
    if (part === "") return [];
    const tokens = part.split(":");
    const values: number[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token === "") return null;
      if (token.includes(".")) {
        if (i !== tokens.length - 1) return null; // v4 only allowed last
        const v4 = ipv4ToBytes(token);
        if (!v4) return null;
        values.push((v4[0] << 8) | v4[1]);
        values.push((v4[2] << 8) | v4[3]);
      } else {
        if (!/^[0-9a-fA-F]{1,4}$/.test(token)) return null;
        values.push(parseInt(token, 16));
      }
    }
    return values;
  };

  const head = expand(headPart);
  const tail = expand(tailPart);
  if (head === null || tail === null) return null;

  let groups: number[];
  if (hasDouble) {
    const missing = 8 - (head.length + tail.length);
    if (missing < 0) return null;
    groups = [...head, ...new Array<number>(missing).fill(0), ...tail];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;

  const bytes: number[] = [];
  for (const group of groups) {
    if (group < 0 || group > 0xffff) return null;
    bytes.push((group >> 8) & 0xff, group & 0xff);
  }
  return bytes;
}

function isReservedIpv4(b: number[]): boolean {
  const [a, second, third] = b;
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 100 && second >= 64 && second <= 127) return true; // CGNAT 100.64/10
  if (a === 169 && second === 254) return true; // link-local
  if (a === 172 && second >= 16 && second <= 31) return true; // private
  if (a === 192 && second === 168) return true; // private
  if (a === 192 && second === 0 && third === 0) return true; // 192.0.0.0/24
  if (a === 192 && second === 0 && third === 2) return true; // TEST-NET-1
  if (a === 192 && second === 88 && third === 99) return true; // 6to4 relay anycast
  if (a === 198 && (second === 18 || second === 19)) return true; // benchmarking
  if (a === 198 && second === 51 && third === 100) return true; // TEST-NET-2
  if (a === 203 && second === 0 && third === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast (224/4), reserved (240/4), broadcast
  return false;
}

function isReservedIpv6(b: number[]): boolean {
  const allZeroExceptLast =
    b.slice(0, 15).every((x) => x === 0);
  if (allZeroExceptLast && b[15] === 0) return true; // :: unspecified
  if (allZeroExceptLast && b[15] === 1) return true; // ::1 loopback

  if (b[0] === 0xff) return true; // ff00::/8 multicast
  if ((b[0] & 0xfe) === 0xfc) return true; // fc00::/7 unique local
  if (b[0] === 0xfe && (b[1] & 0xc0) === 0x80) return true; // fe80::/10 link-local
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x0d && b[3] === 0xb8) {
    return true; // 2001:db8::/32 documentation
  }
  if (
    b[0] === 0x01 &&
    b[1] === 0x00 &&
    b.slice(2, 8).every((x) => x === 0)
  ) {
    return true; // 100::/64 discard-only
  }

  // IPv4-mapped ::ffff:0:0/96 — validate the embedded IPv4.
  const mappedPrefix =
    b.slice(0, 10).every((x) => x === 0) && b[10] === 0xff && b[11] === 0xff;
  if (mappedPrefix) {
    return isReservedIpv4([b[12], b[13], b[14], b[15]]);
  }
  // IPv4/IPv6 translation 64:ff9b::/96 — validate the embedded IPv4.
  if (
    b[0] === 0x00 &&
    b[1] === 0x64 &&
    b[2] === 0xff &&
    b[3] === 0x9b &&
    b.slice(4, 12).every((x) => x === 0)
  ) {
    return isReservedIpv4([b[12], b[13], b[14], b[15]]);
  }
  // 6to4 2002::/16 — validate the embedded IPv4 in bytes 2..5.
  if (b[0] === 0x20 && b[1] === 0x02) {
    return isReservedIpv4([b[2], b[3], b[4], b[5]]);
  }
  return false;
}

/** True only for globally-routable public IPs. Unparseable input is unsafe. */
export function isPublicIpAddress(ip: string): boolean {
  const kind = net.isIP(ip);
  if (kind === 4) {
    const bytes = ipv4ToBytes(ip);
    return bytes !== null && !isReservedIpv4(bytes);
  }
  if (kind === 6) {
    const bytes = ipv6ToBytes(ip);
    return bytes !== null && !isReservedIpv6(bytes);
  }
  return false;
}

/** True when a hostname (not an IP literal) is an internal / service name. */
export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return true;
  if (BLOCKED_HOST_EXACT.has(host)) return true;
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;
  // Single-label names (no dot) are internal service names, not public sites.
  if (!host.includes(".")) return true;
  return false;
}

/** Structural validation: protocol, credentials, host presence. Sync. */
export function parseRequestUrl(raw: string | URL): URL {
  let url: URL;
  try {
    url = raw instanceof URL ? new URL(raw.toString()) : new URL(raw);
  } catch {
    throw new ImportFailure("invalid_url", "URL could not be parsed");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ImportFailure("invalid_url", `Unsupported protocol: ${url.protocol}`, {
      redactedUrl: redactUrlForLog(url),
    });
  }
  if (url.username !== "" || url.password !== "") {
    throw new ImportFailure("invalid_url", "URLs with embedded credentials are not allowed", {
      redactedUrl: redactUrlForLog(url),
    });
  }
  if (!url.hostname) {
    throw new ImportFailure("invalid_url", "URL is missing a hostname", {
      redactedUrl: redactUrlForLog(url),
    });
  }
  return url;
}

/**
 * Full validation flow: structural checks, host allow-listing, DNS resolution,
 * and public-address enforcement. Returns a pinned target for safe connection.
 *
 * The caller MUST connect to `pinnedAddress` (not re-resolve `hostname`) and
 * send `hostHeader` as the Host header / TLS servername to avoid rebinding.
 */
export async function validateUrlForFetch(
  raw: string | URL,
): Promise<ValidatedTarget> {
  const url = parseRequestUrl(raw);
  const protocol = url.protocol as "http:" | "https:";
  const hostname = stripBrackets(url.hostname).toLowerCase();
  const port = url.port
    ? Number(url.port)
    : protocol === "https:"
      ? 443
      : 80;
  const redactedUrl = redactUrlForLog(url);

  const literalKind = net.isIP(hostname);
  let addresses: ResolvedAddress[];

  if (literalKind === 4 || literalKind === 6) {
    if (!isPublicIpAddress(hostname)) {
      throw new ImportFailure(
        "blocked_destination",
        "URL points at a private or reserved IP address",
        { redactedUrl },
      );
    }
    addresses = [{ address: hostname, family: literalKind }];
  } else {
    if (isBlockedHostname(hostname)) {
      throw new ImportFailure(
        "blocked_destination",
        "URL points at an internal or non-public hostname",
        { redactedUrl },
      );
    }

    let resolved: { address: string; family: number }[];
    try {
      resolved = await dns.lookup(hostname, { all: true, verbatim: true });
    } catch (cause) {
      throw new ImportFailure(
        "blocked_destination",
        "Hostname could not be resolved",
        { redactedUrl, cause },
      );
    }
    if (resolved.length === 0) {
      throw new ImportFailure("blocked_destination", "Hostname resolved to no addresses", {
        redactedUrl,
      });
    }
    for (const entry of resolved) {
      if (!isPublicIpAddress(entry.address)) {
        throw new ImportFailure(
          "blocked_destination",
          "Hostname resolves to a private or reserved address",
          { redactedUrl },
        );
      }
    }
    addresses = resolved.map((entry) => ({
      address: entry.address,
      family: entry.family === 6 ? 6 : 4,
    }));
  }

  const pinned = addresses[0];
  const defaultPort = protocol === "https:" ? 443 : 80;
  const hostHeader =
    port === defaultPort ? hostname : `${hostname}:${port}`;

  return {
    url,
    protocol,
    hostname,
    port,
    addresses,
    pinnedAddress: pinned.address,
    pinnedFamily: pinned.family,
    hostHeader,
  };
}
