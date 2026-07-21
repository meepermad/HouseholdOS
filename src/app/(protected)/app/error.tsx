"use client";

import { useEffect, useRef } from "react";
import { DeploymentSkewRecovery } from "@/components/deployment-skew-recovery";
import {
  RecoveryClearHouseholdForm,
  RecoveryLinks,
  RecoveryLogoutForm,
} from "@/components/recovery-actions";
import { RecoveryScreen, recoveryControlClass } from "@/components/recovery-screen";
import { formatErrorReference } from "@/lib/recovery";
import { isDeploymentSkewError } from "@/lib/deployment-skew";

export default function ProtectedAppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const reference = formatErrorReference(error.digest);
  const skew = isDeploymentSkewError(error);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <>
      <DeploymentSkewRecovery error={error} />
      <RecoveryScreen
        headingRef={headingRef}
        title={skew ? "Update required" : "Could not load this screen"}
        body={
          skew
            ? "HouseholdOS was redeployed. Refreshing to load the latest version…"
            : "Retry this page, clear your household selection, or sign out. These actions do not delete expenses or reimbursements."
        }
        reference={reference}
        testId="protected-error-boundary"
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
            {!skew ? <RecoveryLogoutForm variant="secondary" /> : null}
          </>
        }
        secondary={skew ? undefined : <RecoveryClearHouseholdForm />}
        footer={<RecoveryLinks showLogin showRecovery />}
      />
    </>
  );
}
