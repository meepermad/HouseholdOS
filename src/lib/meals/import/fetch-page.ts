import "server-only";

/**
 * Phase 6.6 — secure HTTP(S) fetch for recipe import.
 *
 * Wraps Node's http/https request with the SSRF protections from
 * {@link ./url-security} plus transfer-level safety:
 *  - connect to a validated, pinned IP while preserving Host header / TLS SNI,
 *  - manually re-validate every redirect (max 5), no automatic following,
 *  - hard 3 MB response cap and a 15 s connection + total timeout,
 *  - only HTML/XHTML (or, for robots, text/*) content types,
 *  - never send cookies or auth headers, always use a safe importer UA,
 *  - full AbortSignal support.
 */

import http from "node:http";
import https from "node:https";

import { redactUrlForLog } from "./log-redaction";
import {
  ImportFailure,
  validateUrlForFetch,
  type ValidatedTarget,
} from "./url-security";

/** Product token + contact URL; kept in sync with the robots.txt UA token. */
export const IMPORTER_USER_AGENT =
  "HouseholdOSRecipeImporter/1.0 (+https://householdos.app/recipe-importer; respects robots.txt)";

export const MAX_REDIRECTS = 5;
export const MAX_RESPONSE_BYTES = 3 * 1024 * 1024; // 3 MB
export const REQUEST_TIMEOUT_MS = 15_000; // connection + total

/** What kind of body we will accept. */
export type AcceptMode = "html" | "text";

export type SecureFetchOptions = {
  signal?: AbortSignal;
  maxBytes?: number;
  maxRedirects?: number;
  timeoutMs?: number;
  accept?: AcceptMode;
};

export type FetchedResource = {
  /** Redacted originally-requested URL. */
  requestedUrl: string;
  /** Canonical, credential-free URL actually fetched (query preserved). */
  finalUrl: string;
  /** Redacted final URL, safe for logs. */
  redactedFinalUrl: string;
  status: number;
  contentType: string | null;
  body: string;
  byteLength: number;
  /** Redacted redirect chain (excluding the final URL). */
  redirectChain: string[];
};

type RequestOutcome =
  | { kind: "redirect"; status: number; location: string }
  | { kind: "status"; status: number; contentType: string | null }
  | {
      kind: "body";
      status: number;
      contentType: string | null;
      body: Buffer;
    };

function normalizeContentType(
  raw: string | string[] | undefined,
): string | null {
  if (!raw) return null;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value ? value.split(";")[0].trim().toLowerCase() : null;
}

function isAcceptableContentType(
  contentType: string | null,
  mode: AcceptMode,
): boolean {
  if (mode === "html") {
    return (
      contentType === "text/html" || contentType === "application/xhtml+xml"
    );
  }
  // text mode (robots.txt): accept any text/* plus xhtml as a lenient fallback.
  if (!contentType) return true;
  return contentType.startsWith("text/") || contentType === "application/xhtml+xml";
}

function decodeBody(buffer: Buffer, contentType: string | null): string {
  const charsetMatch = /charset=["']?([^;"'\s]+)/i.exec(contentType ?? "");
  const charset = (charsetMatch?.[1] ?? "utf-8").toLowerCase();
  switch (charset) {
    case "utf-8":
    case "utf8":
    case "us-ascii":
    case "ascii":
      return buffer.toString("utf-8");
    case "iso-8859-1":
    case "latin1":
    case "windows-1252":
    case "cp1252":
      return buffer.toString("latin1");
    case "utf-16":
    case "utf-16le":
      return buffer.toString("utf16le");
    default:
      return buffer.toString("utf-8");
  }
}

function performRequest(
  target: ValidatedTarget,
  signal: AbortSignal,
  timeoutMs: number,
  maxBytes: number,
  mode: AcceptMode,
): Promise<RequestOutcome> {
  return new Promise<RequestOutcome>((resolve, reject) => {
    const isHttps = target.protocol === "https:";
    const client = isHttps ? https : http;
    const redactedUrl = redactUrlForLog(target.url);

    const headers: Record<string, string> = {
      Host: target.hostHeader,
      "User-Agent": IMPORTER_USER_AGENT,
      Accept:
        mode === "html"
          ? "text/html,application/xhtml+xml;q=0.9"
          : "text/plain,text/html;q=0.5",
      "Accept-Language": "en",
      // Avoid compression so the byte cap maps directly to decoded size.
      "Accept-Encoding": "identity",
      Connection: "close",
    };

    const requestOptions: https.RequestOptions = {
      host: target.pinnedAddress,
      port: target.port,
      path: `${target.url.pathname}${target.url.search}`,
      method: "GET",
      headers,
      family: target.pinnedFamily,
      // We set Host ourselves (to the real hostname, not the pinned IP).
      setHost: false,
      signal,
      timeout: timeoutMs,
      ...(isHttps
        ? { servername: target.hostname, rejectUnauthorized: true }
        : {}),
    };

    const req = client.request(requestOptions, (res) => {
      const status = res.statusCode ?? 0;
      const location = res.headers.location;

      if (status >= 300 && status < 400 && location) {
        res.destroy();
        resolve({ kind: "redirect", status, location });
        return;
      }

      const contentType = normalizeContentType(res.headers["content-type"]);

      if (status < 200 || status >= 300) {
        res.destroy();
        resolve({ kind: "status", status, contentType });
        return;
      }

      const declaredLength = Number(res.headers["content-length"]);
      if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        res.destroy();
        reject(
          new ImportFailure(
            "response_too_large",
            `Response exceeds ${maxBytes} byte limit (declared ${declaredLength})`,
            { redactedUrl, httpStatus: status },
          ),
        );
        return;
      }

      const chunks: Buffer[] = [];
      let total = 0;
      let aborted = false;

      res.on("data", (chunk: Buffer) => {
        if (aborted) return;
        total += chunk.length;
        if (total > maxBytes) {
          aborted = true;
          reject(
            new ImportFailure(
              "response_too_large",
              `Response exceeds ${maxBytes} byte limit`,
              { redactedUrl, httpStatus: status },
            ),
          );
          req.destroy();
          res.destroy();
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => {
        if (aborted) return;
        resolve({
          kind: "body",
          status,
          contentType,
          body: Buffer.concat(chunks),
        });
      });
      res.on("error", (err) => {
        if (!aborted) reject(err);
      });
    });

    req.on("timeout", () => {
      req.destroy(
        new ImportFailure("fetch_timeout", "Connection timed out", {
          redactedUrl,
        }),
      );
    });
    req.on("error", (err) => reject(err));
    req.end();
  });
}

/**
 * Core secure fetch with manual redirect handling. Every hop (including the
 * initial URL and every redirect target) is re-validated via
 * {@link validateUrlForFetch} before a connection is made.
 */
export async function secureFetch(
  rawUrl: string | URL,
  options: SecureFetchOptions = {},
): Promise<FetchedResource> {
  const maxBytes = options.maxBytes ?? MAX_RESPONSE_BYTES;
  const maxRedirects = options.maxRedirects ?? MAX_REDIRECTS;
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const mode = options.accept ?? "html";
  const userSignal = options.signal;

  const requestedUrl = redactUrlForLog(rawUrl);

  // One controller enforces the total budget across all redirect hops and
  // merges the caller's abort signal.
  const controller = new AbortController();
  let timedOut = false;
  const onTimeout = () => {
    timedOut = true;
    controller.abort();
  };
  const totalDeadline = setTimeout(onTimeout, timeoutMs);
  const onUserAbort = () => controller.abort();
  if (userSignal) {
    if (userSignal.aborted) controller.abort();
    else userSignal.addEventListener("abort", onUserAbort, { once: true });
  }

  try {
    let currentUrl: string | URL = rawUrl;
    const redirectChain: string[] = [];

    for (let hop = 0; ; hop++) {
      if (controller.signal.aborted) break; // handled in catch/finally below

      const target = await validateUrlForFetch(currentUrl);
      const outcome = await performRequest(
        target,
        controller.signal,
        timeoutMs,
        maxBytes,
        mode,
      );

      if (outcome.kind === "redirect") {
        if (hop >= maxRedirects) {
          throw new ImportFailure(
            "http_error",
            `Exceeded maximum of ${maxRedirects} redirects`,
            { redactedUrl: redactUrlForLog(target.url), httpStatus: outcome.status },
          );
        }
        let nextUrl: URL;
        try {
          nextUrl = new URL(outcome.location, target.url);
        } catch {
          throw new ImportFailure("invalid_url", "Redirect location was not a valid URL", {
            redactedUrl: redactUrlForLog(target.url),
            httpStatus: outcome.status,
          });
        }
        redirectChain.push(redactUrlForLog(target.url));
        currentUrl = nextUrl;
        continue;
      }

      if (outcome.kind === "status") {
        throw httpStatusToFailure(outcome.status, redactUrlForLog(target.url));
      }

      // outcome.kind === "body"
      if (!isAcceptableContentType(outcome.contentType, mode)) {
        throw new ImportFailure(
          "unsupported_content_type",
          `Unsupported content type: ${outcome.contentType ?? "(none)"}`,
          { redactedUrl: redactUrlForLog(target.url), httpStatus: outcome.status },
        );
      }

      const body = decodeBody(outcome.body, outcome.contentType);
      return {
        requestedUrl,
        finalUrl: target.url.toString(),
        redactedFinalUrl: redactUrlForLog(target.url),
        status: outcome.status,
        contentType: outcome.contentType,
        body,
        byteLength: outcome.body.length,
        redirectChain,
      };
    }

    // Loop only exits early on abort.
    throw makeAbortFailure(timedOut, userSignal, requestedUrl);
  } catch (err) {
    throw normalizeFetchError(err, timedOut, userSignal, requestedUrl);
  } finally {
    clearTimeout(totalDeadline);
    if (userSignal) userSignal.removeEventListener("abort", onUserAbort);
  }
}

/** Recipe-page fetch: HTML/XHTML only, 3 MB cap, 5 redirects. */
export async function fetchRecipePage(
  rawUrl: string | URL,
  options: Pick<SecureFetchOptions, "signal"> = {},
): Promise<FetchedResource> {
  return secureFetch(rawUrl, {
    signal: options.signal,
    accept: "html",
    maxBytes: MAX_RESPONSE_BYTES,
    maxRedirects: MAX_REDIRECTS,
    timeoutMs: REQUEST_TIMEOUT_MS,
  });
}

function httpStatusToFailure(status: number, redactedUrl: string): ImportFailure {
  if (status === 401) {
    return new ImportFailure("login_required", "Source requires authentication", {
      redactedUrl,
      httpStatus: status,
    });
  }
  if (status === 402 || status === 403) {
    return new ImportFailure(
      "paywall_or_access_denied",
      "Source denied access (paywall or forbidden)",
      { redactedUrl, httpStatus: status },
    );
  }
  if (status === 429) {
    return new ImportFailure("rate_limited", "Source rate-limited the request", {
      redactedUrl,
      httpStatus: status,
      retryable: true,
    });
  }
  return new ImportFailure("http_error", `Source returned HTTP ${status}`, {
    redactedUrl,
    httpStatus: status,
    retryable: status >= 500,
  });
}

function makeAbortFailure(
  timedOut: boolean,
  userSignal: AbortSignal | undefined,
  redactedUrl: string,
): Error {
  if (timedOut) {
    return new ImportFailure("fetch_timeout", "Fetch exceeded total time budget", {
      redactedUrl,
      retryable: true,
    });
  }
  // Caller-initiated abort: surface a standard AbortError.
  const reason = userSignal?.reason;
  if (reason instanceof Error) return reason;
  const abortError = new Error("Fetch aborted");
  abortError.name = "AbortError";
  return abortError;
}

function normalizeFetchError(
  err: unknown,
  timedOut: boolean,
  userSignal: AbortSignal | undefined,
  redactedUrl: string,
): Error {
  if (err instanceof ImportFailure) return err;

  // Abort from the merged controller surfaces as an AbortError / ABORT_ERR.
  const name = (err as { name?: string })?.name;
  const code = (err as { code?: string })?.code;
  if (name === "AbortError" || code === "ABORT_ERR") {
    return makeAbortFailure(timedOut, userSignal, redactedUrl);
  }
  if (code === "ETIMEDOUT" || code === "ESOCKETTIMEDOUT") {
    return new ImportFailure("fetch_timeout", "Connection timed out", {
      redactedUrl,
      cause: err,
      retryable: true,
    });
  }
  // DNS/connection/TLS errors: treat as an unreachable destination.
  return new ImportFailure("blocked_destination", "Network error while fetching source", {
    redactedUrl,
    cause: err,
  });
}
