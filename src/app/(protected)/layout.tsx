import Link from "next/link";
import {
  RecoveryClearHouseholdForm,
  RecoveryLogoutForm,
} from "@/components/recovery-actions";
import { RecoveryScreen, recoveryControlClass } from "@/components/recovery-screen";
import { ensureProfileOrRecover } from "@/lib/household-context";
import { AppError } from "@/lib/errors";
import {
  LAYOUT_DEADLINE_MS,
  withDeadline,
} from "@/lib/async/with-deadline";
import { redirect } from "next/navigation";

function isNextRedirectError(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    String((error as { digest: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await withDeadline(ensureProfileOrRecover(), {
      ms: LAYOUT_DEADLINE_MS,
      stage: "profile",
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    if (error instanceof AppError && error.code === "database_failure") {
      return (
        <RecoveryScreen
          title="Profile recovery needed"
          body={error.publicMessage}
          primary={
            <>
              <a href="." className={recoveryControlClass.primary}>
                Retry
              </a>
              <Link href="/recovery" className={recoveryControlClass.secondary}>
                Open recovery
              </Link>
              <RecoveryLogoutForm
                label="Sign out and try again"
                variant="secondary"
              />
            </>
          }
          secondary={<RecoveryClearHouseholdForm next="/onboarding" />}
        />
      );
    }
    redirect("/login?reason=session_expired");
  }

  return <>{children}</>;
}
