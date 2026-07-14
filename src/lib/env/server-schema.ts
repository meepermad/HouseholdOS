import { z } from "zod";
import { publicEnvSchema, ConfigurationError } from "@/lib/env/public";

export const REGISTRATION_MODES = ["bootstrap_only", "invite_only", "open"] as const;
export type RegistrationMode = (typeof REGISTRATION_MODES)[number];

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
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
    SUPABASE_SECRET_KEY: source.SUPABASE_SECRET_KEY || undefined,
    APP_URL: source.APP_URL ?? "http://localhost:3000",
    APP_ENV: source.APP_ENV ?? "development",
    REGISTRATION_MODE: source.REGISTRATION_MODE ?? "bootstrap_only",
    BOOTSTRAP_EMAIL: source.BOOTSTRAP_EMAIL || undefined,
    INVITATION_TTL_HOURS: source.INVITATION_TTL_HOURS ?? "168",
    DEFAULT_TIMEZONE: source.DEFAULT_TIMEZONE ?? "America/Chicago",
    DEFAULT_CURRENCY: source.DEFAULT_CURRENCY ?? "USD",
  });

  if (!result.success) {
    const detail = result.error.issues.map((i) => i.message).join("; ");
    throw new ConfigurationError(`Invalid server environment configuration: ${detail}`);
  }

  return result.data;
}
