import { z } from "zod";
import { publicEnvSchema, ConfigurationError } from "@/lib/env/public";

export const REGISTRATION_MODES = ["bootstrap_only", "invite_only", "open"] as const;
export type RegistrationMode = (typeof REGISTRATION_MODES)[number];

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function optionalNonEmptyString(min = 1) {
  return z.preprocess(
    (value) =>
      typeof value === "string" && value.trim().length > 0
        ? value.trim()
        : undefined,
    z.string().min(min).optional(),
  );
}

function coerceBool(defaultValue: boolean) {
  return z.preprocess((value) => {
    if (value === undefined || value === null || value === "") {
      return defaultValue;
    }
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["1", "true", "yes", "on"].includes(normalized)) return true;
      if (["0", "false", "no", "off"].includes(normalized)) return false;
    }
    return defaultValue;
  }, z.boolean());
}

export const serverEnvSchema = publicEnvSchema
  .extend({
    SUPABASE_SECRET_KEY: z.string().min(20).optional(),
    APP_URL: z.string().url("APP_URL must be a valid URL"),
    APP_ENV: z.enum(["development", "test", "production"]).default("development"),
    REGISTRATION_MODE: z.enum(REGISTRATION_MODES).default("bootstrap_only"),
    BOOTSTRAP_EMAIL: z.preprocess(
      (value) =>
        typeof value === "string" && value.length > 0
          ? normalizeEmail(value)
          : undefined,
      z.email().optional(),
    ),
    INVITATION_TTL_HOURS: z.coerce.number().int().positive().default(168),
    DEFAULT_TIMEZONE: z
      .string()
      .min(1)
      .refine(
        (tz) => {
          try {
            Intl.DateTimeFormat(undefined, { timeZone: tz });
            return true;
          } catch {
            return false;
          }
        },
        { message: "DEFAULT_TIMEZONE must be a valid IANA timezone" },
      )
      .default("America/Chicago"),
    DEFAULT_CURRENCY: z
      .string()
      .regex(/^[A-Z]{3}$/, "DEFAULT_CURRENCY must be a three-letter uppercase code")
      .default("USD"),
    NOTIFICATION_WORKER_SECRET: optionalNonEmptyString(16),
    DOCUMENT_JOB_WORKER_SECRET: optionalNonEmptyString(16),
    EXPORT_WORKER_SECRET: optionalNonEmptyString(16),
    SYNC_WORKER_SECRET: optionalNonEmptyString(16),
    VAPID_PRIVATE_KEY: optionalNonEmptyString(),
    VAPID_SUBJECT: z.preprocess(
      (value) =>
        typeof value === "string" && value.trim().length > 0
          ? value.trim()
          : undefined,
      z
        .string()
        .refine(
          (v) => v.startsWith("mailto:") || /^https:\/\//i.test(v),
          {
            message: "VAPID_SUBJECT must be a mailto: address or https URL",
          },
        )
        .optional(),
    ),
    NOTIFICATION_DELIVERY_ENABLED: coerceBool(false),
    EMAIL_NOTIFICATIONS_ENABLED: coerceBool(false),
    EMAIL_PROVIDER: optionalNonEmptyString(),
    EMAIL_API_KEY: optionalNonEmptyString(),
    EMAIL_FROM: optionalNonEmptyString(),
  })
  .superRefine((data, ctx) => {
    if (data.REGISTRATION_MODE === "bootstrap_only" && !data.BOOTSTRAP_EMAIL) {
      ctx.addIssue({
        code: "custom",
        path: ["BOOTSTRAP_EMAIL"],
        message: "BOOTSTRAP_EMAIL is required when REGISTRATION_MODE=bootstrap_only",
      });
    }

    if (data.REGISTRATION_MODE === "open" && data.APP_ENV === "production") {
      ctx.addIssue({
        code: "custom",
        path: ["REGISTRATION_MODE"],
        message:
          "REGISTRATION_MODE=open is not allowed in production. Use bootstrap_only or invite_only.",
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(
  source: Record<string, string | undefined> = process.env,
): ServerEnv {
  const result = serverEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: source.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: source.NEXT_PUBLIC_VAPID_PUBLIC_KEY || undefined,
    SUPABASE_SECRET_KEY: source.SUPABASE_SECRET_KEY || undefined,
    APP_URL: source.APP_URL ?? "http://localhost:3000",
    APP_ENV: source.APP_ENV ?? "development",
    REGISTRATION_MODE: source.REGISTRATION_MODE ?? "bootstrap_only",
    BOOTSTRAP_EMAIL: source.BOOTSTRAP_EMAIL || undefined,
    INVITATION_TTL_HOURS: source.INVITATION_TTL_HOURS ?? "168",
    DEFAULT_TIMEZONE: source.DEFAULT_TIMEZONE ?? "America/Chicago",
    DEFAULT_CURRENCY: source.DEFAULT_CURRENCY ?? "USD",
    NOTIFICATION_WORKER_SECRET: source.NOTIFICATION_WORKER_SECRET || undefined,
    DOCUMENT_JOB_WORKER_SECRET: source.DOCUMENT_JOB_WORKER_SECRET || undefined,
    EXPORT_WORKER_SECRET: source.EXPORT_WORKER_SECRET || undefined,
    SYNC_WORKER_SECRET: source.SYNC_WORKER_SECRET || undefined,
    VAPID_PRIVATE_KEY: source.VAPID_PRIVATE_KEY || undefined,
    VAPID_SUBJECT: source.VAPID_SUBJECT || undefined,
    NOTIFICATION_DELIVERY_ENABLED: source.NOTIFICATION_DELIVERY_ENABLED,
    EMAIL_NOTIFICATIONS_ENABLED: source.EMAIL_NOTIFICATIONS_ENABLED,
    EMAIL_PROVIDER: source.EMAIL_PROVIDER || undefined,
    EMAIL_API_KEY: source.EMAIL_API_KEY || undefined,
    EMAIL_FROM: source.EMAIL_FROM || undefined,
  });

  if (!result.success) {
    const detail = result.error.issues.map((i) => i.message).join("; ");
    throw new ConfigurationError(`Invalid server environment configuration: ${detail}`);
  }

  return result.data;
}
