import { createHash } from "node:crypto";
import { z } from "zod";

export function hashEndpoint(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex");
}

export const pushSubscriptionKeysSchema = z.object({
  p256dh: z.string().min(1).max(512),
  auth: z.string().min(1).max(256),
});

export const pushSubscriptionClientSchema = z.object({
  endpoint: z.string().url().max(2048),
  expirationTime: z.number().int().nonnegative().nullable().optional(),
  keys: pushSubscriptionKeysSchema,
  deviceLabel: z.string().trim().min(1).max(64).optional(),
  installationId: z.string().uuid().optional(),
});

export type PushSubscriptionClient = z.infer<typeof pushSubscriptionClientSchema>;

export type UserAgentSummary = {
  platformCategory: "mobile" | "desktop" | "tablet" | "unknown";
  userAgentSummary: string;
};

export function summarizeUserAgent(ua: string | null): UserAgentSummary {
  if (!ua || !ua.trim()) {
    return { platformCategory: "unknown", userAgentSummary: "unknown" };
  }

  const lower = ua.toLowerCase();
  let platformCategory: UserAgentSummary["platformCategory"] = "unknown";

  if (
    /ipad|tablet|kindle|silk|(android(?!.*mobile))/.test(lower)
  ) {
    platformCategory = "tablet";
  } else if (
    /mobi|iphone|ipod|android.*mobile|windows phone|opera mini/.test(lower)
  ) {
    platformCategory = "mobile";
  } else if (
    /windows|macintosh|linux|cros|x11/.test(lower)
  ) {
    platformCategory = "desktop";
  }

  const browser =
    /edg\//.test(lower)
      ? "Edge"
      : /chrome\//.test(lower) && !/edg\//.test(lower)
        ? "Chrome"
        : /firefox\//.test(lower)
          ? "Firefox"
          : /safari\//.test(lower) && !/chrome\//.test(lower)
            ? "Safari"
            : "Browser";

  const os =
    /windows/.test(lower)
      ? "Windows"
      : /android/.test(lower)
        ? "Android"
        : /iphone|ipad|ipod|mac os/.test(lower)
          ? "Apple"
          : /linux|cros/.test(lower)
            ? "Linux"
            : "OS";

  const summary = `${platformCategory}/${os}/${browser}`.slice(0, 64);
  return { platformCategory, userAgentSummary: summary };
}
