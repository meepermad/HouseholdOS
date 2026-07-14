import { z } from "zod";

const DASHBOARD_URL_PATTERN = /supabase\.com\/dashboard/i;

function rejectDashboardUrl(value: string, ctx: z.RefinementCtx) {
  if (DASHBOARD_URL_PATTERN.test(value)) {
    ctx.addIssue({
      code: "custom",
      message:
        "NEXT_PUBLIC_SUPABASE_URL must be the API gateway URL (e.g. https://<ref>.supabase.co), not a Dashboard URL.",
    });
  }
}

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_URL is required")
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL")
    .superRefine(rejectDashboardUrl),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(20, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing or incomplete"),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export class ConfigurationError extends Error {
  readonly code = "missing_configuration" as const;

  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export function parsePublicEnv(
  source: Record<string, string | undefined> = process.env,
): PublicEnv {
  const result = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: source.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  if (!result.success) {
    const detail = result.error.issues.map((i) => i.message).join("; ");
    throw new ConfigurationError(`Invalid public environment configuration: ${detail}`);
  }

  return result.data;
}

let cached: PublicEnv | undefined;

export function getPublicEnv(): PublicEnv {
  if (!cached) {
    cached = parsePublicEnv();
  }
  return cached;
}

/** Test helper — clears memoized public env. */
export function resetPublicEnvCache(): void {
  cached = undefined;
}
