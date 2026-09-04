import Link from "next/link";
import {
  RecoveryClearHouseholdForm,
  RecoveryLogoutForm,
} from "@/components/recovery-actions";
import { RecoveryScreen, recoveryControlClass } from "@/components/recovery-screen";
import { loginUrlForPath } from "@/lib/auth/login-next";
import { currentRequestPath } from "@/lib/auth/request-path";
import { ensureProfileOrRecover } from "@/lib/household-context";
import { AppError } from "@/lib/errors";
import {
  LAYOUT_DEADLINE_MS,
  withDeadline,
} from "@/lib/async/with-deadline";
import { isNextRedirectError } from "@/lib/navigation-errors";
import { redirect } from "next/navigation";

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
    redirect(
      loginUrlForPath(await currentRequestPath("/app"), "session_expired"),
    );
  }

  return <>{children}</>;
}
