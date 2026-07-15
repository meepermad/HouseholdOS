import { notFound } from "next/navigation";

/**
 * Non-production-only route that throws for error-boundary e2e coverage.
 * Unavailable when NODE_ENV or APP_ENV is production.
 */
export default function DevTriggerErrorPage() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.APP_ENV === "production"
  ) {
    notFound();
  }

  throw new Error("HouseholdOS intentional development error");
}
