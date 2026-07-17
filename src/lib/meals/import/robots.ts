import "server-only";

/**
 * Phase 6.6 — robots.txt policy for recipe import.
 *
 * Fetches `/robots.txt` through the same SSRF-hardened mechanism as the recipe
 * page (no recursive robots check for the robots request itself), then applies
 * Disallow/Allow rules for the explicit `HouseholdOSRecipeImporter` product
 * token, falling back to the `*` group. We respect what the site declares and
 * never attempt evasion.
 *
 * Failure posture: a missing/4xx robots.txt means "allowed" (standard
 * behavior). If the destination is fundamentally unsafe (blocked/invalid) the
 * underlying error propagates. Transient robots fetch problems (timeout, 5xx,
 * network) default to allowed so a flaky robots endpoint does not block an
 * otherwise valid import.
 */

import { redactUrlForLog } from "./log-redaction";
import { secureFetch } from "./fetch-page";
import { ImportFailure } from "./url-security";

/** Lowercase product token matched against robots User-agent lines. */
export const ROBOTS_USER_AGENT_TOKEN = "householdosrecipeimporter";

/** Robots.txt is small; cap generously below the page limit. */
const ROBOTS_MAX_BYTES = 512 * 1024; // 512 KB

type RobotsRule = { type: "allow" | "disallow"; path: string };

export type RobotsPolicy = {
  /** Rules applicable to our user-agent (most specific group or `*`). */
  rules: RobotsRule[];
  /** Whether a robots.txt was found and parsed. */
  hasRobots: boolean;
  /** Which group matched: a specific token, `*`, or none. */
  matchedGroup: string | null;
};

export type RobotsDecision = {
  allowed: boolean;
  hadRobots: boolean;
  matchedGroup: string | null;
};

/**
 * Parse robots.txt into a map of lowercase user-agent token -> rules.
 * Consecutive User-agent lines share the rule block that follows them.
 */
function parseRobotsGroups(text: string): Map<string, RobotsRule[]> {
  const groups = new Map<string, RobotsRule[]>();
  let currentAgents: string[] = [];
  let expectingAgent = true;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (field === "user-agent") {
      // A user-agent line after rules starts a new group.
      if (!expectingAgent) {
        currentAgents = [];
        expectingAgent = true;
      }
      const agent = value.toLowerCase();
      currentAgents.push(agent);
      if (!groups.has(agent)) groups.set(agent, []);
    } else if (field === "allow" || field === "disallow") {
      expectingAgent = false;
      if (currentAgents.length === 0) continue;
      const rule: RobotsRule = { type: field, path: value };
      for (const agent of currentAgents) groups.get(agent)?.push(rule);
    }
    // crawl-delay, sitemap, host, etc. are intentionally ignored.
  }
  return groups;
}

/**
 * Select the rule group for our token. Per the robots spec, a group matches
 * when its user-agent value is a case-insensitive prefix of our product token;
 * the longest such match wins, otherwise the `*` group applies.
 */
function selectRules(
  groups: Map<string, RobotsRule[]>,
): { rules: RobotsRule[]; matchedGroup: string | null } {
  let best: string | null = null;
  for (const key of groups.keys()) {
    if (key === "*" || key === "") continue;
    if (ROBOTS_USER_AGENT_TOKEN.startsWith(key)) {
      if (best === null || key.length > best.length) best = key;
    }
  }
  if (best !== null) return { rules: groups.get(best) ?? [], matchedGroup: best };
  if (groups.has("*")) return { rules: groups.get("*") ?? [], matchedGroup: "*" };
  return { rules: [], matchedGroup: null };
}

function escapeRegExp(input: string): string {
  return input.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Match a robots path pattern (supporting `*` wildcards and a trailing `$`
 * anchor) against a request path. Returns a specificity score (pattern length
 * excluding wildcard chars) when it matches, or null.
 */
function matchPattern(pattern: string, path: string): number | null {
  let regex = "";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "*") {
      regex += ".*";
    } else if (ch === "$" && i === pattern.length - 1) {
      regex += "$";
    } else {
      regex += escapeRegExp(ch);
    }
  }
  const matched = new RegExp(`^${regex}`).test(path);
  if (!matched) return null;
  return pattern.replace(/[*$]/g, "").length;
}

/**
 * Apply parsed rules to a path. Longest matching rule wins; on ties Allow beats
 * Disallow. An empty Disallow value (or no rules) means allowed.
 */
export function isPathAllowed(rules: RobotsRule[], path: string): boolean {
  let best: { score: number; allow: boolean } | null = null;
  for (const rule of rules) {
    if (rule.path === "") continue; // empty Disallow => no restriction
    const score = matchPattern(rule.path, path);
    if (score === null) continue;
    const allow = rule.type === "allow";
    if (
      best === null ||
      score > best.score ||
      (score === best.score && allow)
    ) {
      best = { score, allow };
    }
  }
  return best === null ? true : best.allow;
}

/**
 * Fetch robots.txt for the origin of `pageUrl`. Returns the text, or null when
 * robots.txt is absent / inaccessible (which callers treat as "allowed").
 * SSRF-fatal errors (invalid_url, blocked_destination) propagate.
 */
export async function fetchRobotsTxt(
  pageUrl: string | URL,
  options: { signal?: AbortSignal } = {},
): Promise<string | null> {
  const origin = new URL(pageUrl.toString());
  const robotsUrl = `${origin.protocol}//${origin.host}/robots.txt`;

  try {
    const result = await secureFetch(robotsUrl, {
      signal: options.signal,
      accept: "text",
      maxBytes: ROBOTS_MAX_BYTES,
    });
    return result.status === 200 ? result.body : null;
  } catch (err) {
    if (err instanceof ImportFailure) {
      // Destination is fundamentally unsafe/invalid: let the caller fail hard.
      if (err.category === "invalid_url" || err.category === "blocked_destination") {
        throw err;
      }
      // Missing/forbidden/timeout/oversized robots => assume allowed.
      return null;
    }
    throw err;
  }
}

/** Build a {@link RobotsPolicy} from robots.txt text (or null for none). */
export function buildRobotsPolicy(text: string | null): RobotsPolicy {
  if (text === null) {
    return { rules: [], hasRobots: false, matchedGroup: null };
  }
  const groups = parseRobotsGroups(text);
  const { rules, matchedGroup } = selectRules(groups);
  return { rules, hasRobots: true, matchedGroup };
}

/** Fetch + parse + evaluate robots for a specific recipe URL. */
export async function checkRobotsAllowed(
  pageUrl: string | URL,
  options: { signal?: AbortSignal } = {},
): Promise<RobotsDecision> {
  const text = await fetchRobotsTxt(pageUrl, options);
  const policy = buildRobotsPolicy(text);
  const url = new URL(pageUrl.toString());
  const path = `${url.pathname}${url.search}` || "/";
  const allowed = isPathAllowed(policy.rules, path);
  return { allowed, hadRobots: policy.hasRobots, matchedGroup: policy.matchedGroup };
}

/**
 * Throw an {@link ImportFailure} (`robots_disallowed`) when robots.txt blocks
 * the recipe URL for our user-agent. Otherwise resolves quietly.
 */
export async function assertRobotsAllowed(
  pageUrl: string | URL,
  options: { signal?: AbortSignal } = {},
): Promise<void> {
  const decision = await checkRobotsAllowed(pageUrl, options);
  if (!decision.allowed) {
    throw new ImportFailure("robots_disallowed", "Blocked by robots.txt", {
      redactedUrl: redactUrlForLog(pageUrl),
    });
  }
}
