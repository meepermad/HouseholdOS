"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DeploymentSkewRecovery } from "@/components/deployment-skew-recovery";
import {
  RecoveryClearHouseholdForm,
  RecoveryLinks,
  RecoveryLogoutForm,
} from "@/components/recovery-actions";
import { RecoveryScreen, recoveryControlClass } from "@/components/recovery-screen";
import { loginUrlForPath, receiptCaptureReturnPath } from "@/lib/auth/login-next";
import { formatErrorReference } from "@/lib/recovery";
import { isDeploymentSkewError } from "@/lib/deployment-skew";
import {
  classifyHouseholdPageError,
  householdReceiptsPathFromLocation,
} from "@/lib/recovery/household-page-error";

export default function HouseholdError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const reference = formatErrorReference(error.digest);
  const copy = classifyHouseholdPageError(error);
  const skew = isDeploymentSkewError(error);
  const [receiptsPath, setReceiptsPath] = useState<{ householdId: string } | null>(
    null,
  );

  useEffect(() => {
    headingRef.current?.focus();
    setReceiptsPath(householdReceiptsPathFromLocation(window.location.pathname));
  }, []);

  return (
    <>
      <DeploymentSkewRecovery error={error} />
      <RecoveryScreen
        headingRef={headingRef}
        title={copy.title}
        body={copy.body}
        reference={reference}
        testId="household-error-boundary"
        primary={
          <>
            <button
              type="button"
              onClick={() => {
                if (skew) {
                  window.location.reload();
                  return;
                }
                reset();
              }}
              aria-label={skew ? "Refresh page" : "Try again"}
              data-testid="error-retry"
              className={recoveryControlClass.primary}
            >
              {skew ? "Refresh now" : "Try again"}
            </button>
            {receiptsPath ? (
              <>
                <Link
                  href={receiptCaptureReturnPath(receiptsPath.householdId)}
                  className={recoveryControlClass.secondary}
                  data-testid="error-add-receipt"
                >
                  Add a receipt
                </Link>
                <Link
                  href={`/app/${receiptsPath.householdId}/money/expenses/new`}
                  className={recoveryControlClass.secondary}
                  data-testid="error-enter-manually"
                >
                  Enter manually
                </Link>
                {copy.kind === "session" ? (
                  <Link
                    href={loginUrlForPath(
                      receiptCaptureReturnPath(receiptsPath.householdId),
                      "session_expired",
                    )}
                    className={recoveryControlClass.secondary}
                    data-testid="error-sign-in-again"
                  >
                    Sign in again
                  </Link>
                ) : null}
              </>
            ) : null}
            <button
              type="button"
              className={recoveryControlClass.secondary}
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.set("_hos_dpl", String(Date.now()));
                window.location.assign(url.toString());
              }}
            >
              Reload latest version
            </button>
            <Link href="/app" className={recoveryControlClass.secondary}>
              Choose household
            </Link>
            {copy.showLogout && !skew ? (
              <RecoveryLogoutForm variant="secondary" />
            ) : null}
          </>
        }
        secondary={skew ? undefined : <RecoveryClearHouseholdForm />}
        footer={<RecoveryLinks showLogin showRecovery />}
      />
    </>
  );
}
