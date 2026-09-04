"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { RecoveryLinks, RecoveryLogoutForm } from "@/components/recovery-actions";
import { RecoveryScreen, recoveryControlClass } from "@/components/recovery-screen";
import { loginUrlForPath, receiptCaptureReturnPath } from "@/lib/auth/login-next";
import { formatErrorReference } from "@/lib/recovery";
import {
  classifyHouseholdPageError,
  householdReceiptsPathFromLocation,
} from "@/lib/recovery/household-page-error";

export default function ReceiptsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const copy = classifyHouseholdPageError(error);
  const reference = formatErrorReference(error.digest);
  const householdId = useSyncExternalStore(
    () => () => {},
    () =>
      householdReceiptsPathFromLocation(window.location.pathname)?.householdId ??
      null,
    () => null,
  );

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <RecoveryScreen
      headingRef={headingRef}
      title={copy.kind === "generic" ? "Could not add this receipt" : copy.title}
      body={
        copy.kind === "session"
          ? "Your session expired. Sign in again, then you can add this receipt."
          : copy.kind === "receipt"
            ? copy.body
            : "Try another photo, enter the purchase manually, or sign in again if your session expired."
      }
      reference={reference}
      testId="receipts-error-boundary"
      primary={
        <>
          <button
            type="button"
            onClick={() => reset()}
            aria-label="Try again"
            data-testid="error-retry"
            className={recoveryControlClass.primary}
          >
            Try again
          </button>
          {householdId ? (
            <>
              <Link
                href={receiptCaptureReturnPath(householdId)}
                className={recoveryControlClass.secondary}
                data-testid="error-add-receipt"
              >
                Add a receipt
              </Link>
              <Link
                href={`/app/${householdId}/money/expenses/new`}
                className={recoveryControlClass.secondary}
                data-testid="error-enter-manually"
              >
                Enter manually
              </Link>
              <Link
                href={loginUrlForPath(
                  receiptCaptureReturnPath(householdId),
                  "session_expired",
                )}
                className={recoveryControlClass.secondary}
                data-testid="error-sign-in-again"
              >
                Sign in again
              </Link>
            </>
          ) : (
            <Link href="/app" className={recoveryControlClass.secondary}>
              Choose household
            </Link>
          )}
          {copy.showLogout ? <RecoveryLogoutForm variant="secondary" /> : null}
        </>
      }
      footer={<RecoveryLinks showLogin showRecovery />}
    />
  );
}
