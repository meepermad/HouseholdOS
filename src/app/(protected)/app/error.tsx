"use client";

import { useEffect, useRef } from "react";
import {
  RecoveryClearHouseholdForm,
  RecoveryLinks,
  RecoveryLogoutForm,
} from "@/components/recovery-actions";
import { RecoveryScreen, recoveryControlClass } from "@/components/recovery-screen";
import { formatErrorReference } from "@/lib/recovery";

export default function ProtectedAppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const reference = formatErrorReference(error.digest);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <RecoveryScreen
      headingRef={headingRef}
      title="Could not load this screen"
      body="Retry this page, clear your household selection, or sign out. These actions do not delete expenses or reimbursements."
      reference={reference}
      testId="protected-error-boundary"
      primary={
        <>
          <button
            type="button"
            onClick={reset}
            aria-label="Try again"
            data-testid="error-retry"
            className={recoveryControlClass.primary}
          >
            Try again
          </button>
          <RecoveryLogoutForm variant="secondary" />
        </>
      }
      secondary={<RecoveryClearHouseholdForm />}
      footer={<RecoveryLinks showLogin showRecovery />}
    />
  );
}
