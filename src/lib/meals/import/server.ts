import "server-only";

/**
 * Server-only recipe import entry: SSRF validation, fetch, robots.
 * Pure parsers remain available from `@/lib/meals/import`.
 */

export {
  IMPORT_FAILURE_CATEGORIES,
  ImportFailure,
  isImportFailure,
  isPublicIpAddress,
  isBlockedHostname,
  parseRequestUrl,
  validateUrlForFetch,
} from "./url-security";
export type {
  ImportFailureCategory,
  ResolvedAddress,
  ValidatedTarget,
} from "./url-security";
export {
  IMPORTER_USER_AGENT,
  MAX_REDIRECTS,
  MAX_RESPONSE_BYTES,
  REQUEST_TIMEOUT_MS,
  fetchRecipePage,
  secureFetch,
} from "./fetch-page";
export type { AcceptMode, FetchedResource, SecureFetchOptions } from "./fetch-page";
export {
  ROBOTS_USER_AGENT_TOKEN,
  assertRobotsAllowed,
  buildRobotsPolicy,
  checkRobotsAllowed,
  isPathAllowed,
} from "./robots";
export {
  redactUrlForLog,
  redactUrlsInText,
  safeHostnameForLog,
} from "./log-redaction";
export { RECIPE_IMPORT_PARSER_VERSION } from "./types";
export { runRecipeImportPipeline } from "./pipeline";
export {
  candidateToReviewPayload,
  warningMessages,
} from "./to-review-payload";
