import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const FEED_SCOPES = ["visible_to_me", "household_public_only"] as const;
export type FeedScope = (typeof FEED_SCOPES)[number];

export const DEFAULT_FEED_SCOPE: FeedScope = "visible_to_me";

/** 32 bytes → 64 hex chars. Treat like a password. */
export function generateFeedToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashFeedToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function feedTokensEqual(rawToken: string, storedHash: string): boolean {
  const a = Buffer.from(hashFeedToken(rawToken), "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function buildFeedUrl(params: {
  origin: string;
  rawToken: string;
}): string {
  const origin = params.origin.replace(/\/$/, "");
  return `${origin}/api/calendar/feed/${params.rawToken}.ics`;
}

export function stripFeedTokenSuffix(param: string): string {
  return param.endsWith(".ics") ? param.slice(0, -4) : param;
}

/** Stable UID for ICS and cross-system identity. */
export function buildCalendarUid(params: {
  householdId: string;
  eventId: string;
  /** For occurrence overrides, include original start */
  occurrenceKey?: string | null;
}): string {
  const base = `householdos-${params.householdId}-${params.eventId}`;
  if (params.occurrenceKey) {
    const key = params.occurrenceKey.replace(/[^a-zA-Z0-9]/g, "");
    return `${base}-${key}@householdos.app`;
  }
  return `${base}@householdos.app`;
}

export function safeEventDeepLink(params: {
  origin: string;
  householdId: string;
  eventId: string;
}): string {
  const origin = params.origin.replace(/\/$/, "");
  return `${origin}/app/${params.householdId}/calendar/events/${params.eventId}`;
}
