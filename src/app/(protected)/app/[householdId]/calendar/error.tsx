"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  RecoveryClearHouseholdForm,
  RecoveryLinks,
  RecoveryLogoutForm,
} from "@/components/recovery-actions";
import { RecoveryScreen, recoveryControlClass } from "@/components/recovery-screen";
import { formatErrorReference } from "@/lib/recovery";
import { householdRoutes } from "@/lib/routes/household";

export default function CalendarError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const reference = formatErrorReference(error.digest);
  const params = useParams<{ householdId?: string }>();
  const householdId =
    typeof params?.householdId === "string" ? params.householdId : null;

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <RecoveryScreen
      headingRef={headingRef}
      title="Could not load Calendar"
      body="Retry Calendar, return to Agenda, or go Home. Your events are not deleted by these actions."
      reference={reference}
      testId="calendar-error-boundary"
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
          {householdId ? (
            <Link
              href={householdRoutes.calendar.agenda(householdId)}
              className={recoveryControlClass.secondary}
              data-testid="calendar-error-agenda"
            >
              Return to Agenda
            </Link>
          ) : null}
          {householdId ? (
            <Link
              href={householdRoutes.home(householdId)}
              className={recoveryControlClass.secondary}
              data-testid="calendar-error-home"
            >
              Return Home
            </Link>
          ) : null}
          <RecoveryLogoutForm variant="secondary" />
        </>
      }
      secondary={<RecoveryClearHouseholdForm />}
      footer={<RecoveryLinks showLogin showRecovery />}
    />
  );
}
