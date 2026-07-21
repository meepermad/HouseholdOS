"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { DeploymentSkewRecovery } from "@/components/deployment-skew-recovery";
import {
  RecoveryClearHouseholdForm,
  RecoveryLinks,
  RecoveryLogoutForm,
} from "@/components/recovery-actions";
import { RecoveryScreen, recoveryControlClass } from "@/components/recovery-screen";
import { formatErrorReference } from "@/lib/recovery";
import { isDeploymentSkewError } from "@/lib/deployment-skew";
import { AppError } from "@/lib/errors";

function classifyHouseholdPageError(error: Error & { digest?: string }): {
  title: string;
  body: string;
  showLogout: boolean;
} {
  if (isDeploymentSkewError(error)) {
    return {
      title: "Update required",
      body: "HouseholdOS was redeployed. Refreshing to load the latest version…",
      showLogout: false,
    };
  }

  const message = error.message.toLowerCase();
  if (
    message.includes("sign in") ||
    message.includes("session") ||
    message.includes("auth")
  ) {
    return {
      title: "Session expired",
      body: "Your session ended. Sign in again — this is not a password problem if you just signed in successfully.",
      showLogout: true,
    };
  }

  if (error instanceof AppError) {
    if (error.code === "authorization") {
      return {
        title: "Household unavailable",
        body: error.publicMessage,
        showLogout: true,
      };
    }
    if (error.code === "not_found") {
      return {
        title: "Household not found",
        body: error.publicMessage,
        showLogout: true,
      };
    }
    if (error.code === "database_failure") {
      const timedOut = error.publicMessage.toLowerCase().includes("timed out");
      return {
        title: timedOut ? "Load timed out" : "Database unavailable",
        body: error.publicMessage,
        showLogout: true,
      };
    }
  }

  if (message.includes("timed out")) {
    return {
      title: "Load timed out",
      body: error.message,
      showLogout: true,
    };
  }

  return {
    title: "Page failed after login",
    body: "This household screen hit a problem after authentication. Retry, return Home, or sign out. Your password was not rejected.",
    showLogout: true,
  };
}

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

  useEffect(() => {
    headingRef.current?.focus();
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
