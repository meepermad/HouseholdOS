import { logServerError } from "@/lib/errors";

type RecoveryLogFields = {
  category: string;
  route?: string;
  digest?: string | null;
  userId?: string | null;
  householdId?: string | null;
  correlationId?: string | null;
};

/** Safe structured recovery/error log — no secrets or tokens. */
export function logRecoveryEvent(
  scope: string,
  error: unknown,
  fields: RecoveryLogFields,
): void {
  logServerError(scope, error, {
    category: fields.category,
    route: fields.route ?? null,
    digest: fields.digest ?? null,
    userId: fields.userId ?? null,
    householdId: fields.householdId ?? null,
    correlationId: fields.correlationId ?? null,
    env: process.env.APP_ENV ?? process.env.NODE_ENV ?? "unknown",
    timestamp: new Date().toISOString(),
  });
}
