"use client";

import { useEffect, useState, startTransition } from "react";
import {
  hasExhaustedSkewReload,
  isDeploymentSkewError,
  reloadOnceForDeploymentSkew,
} from "@/lib/deployment-skew";
import { RecoveryScreen, recoveryControlClass } from "@/components/recovery-screen";

type Props = {
  error?: unknown;
  deployMarker?: string;
  /** When true, only auto-reload; do not render the recovery panel. */
  silent?: boolean;
};

/**
 * One-shot hard reload on confirmed Server Action / chunk skew.
 * After a failed reload for the same deploy marker, shows a recovery screen.
 */
export function DeploymentSkewRecovery({
  error,
  deployMarker = "unknown",
  silent = false,
}: Props) {
  const [showRecovery, setShowRecovery] = useState(false);

  useEffect(() => {
    if (!isDeploymentSkewError(error)) return;
    if (hasExhaustedSkewReload(deployMarker)) {
      startTransition(() => setShowRecovery(true));
      return;
    }
    reloadOnceForDeploymentSkew(deployMarker);
  }, [error, deployMarker]);

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (!isDeploymentSkewError(event.error) && !isDeploymentSkewError(event.message)) {
        return;
      }
      if (hasExhaustedSkewReload(deployMarker)) {
        startTransition(() => setShowRecovery(true));
        return;
      }
      reloadOnceForDeploymentSkew(deployMarker);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      if (!isDeploymentSkewError(event.reason)) return;
      if (hasExhaustedSkewReload(deployMarker)) {
        startTransition(() => setShowRecovery(true));
        return;
      }
      reloadOnceForDeploymentSkew(deployMarker);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [deployMarker]);

  if (silent || !showRecovery) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-background/95 p-4">
      <RecoveryScreen
        testId="deployment-skew-recovery"
        title="Your app was updated while this page was open."
        body="Reload to use the latest version, or return to sign in. Unsaved server actions from the old page were not applied."
        primary={
          <>
            <button
              type="button"
              className={recoveryControlClass.primary}
              onClick={() => {
                try {
                  sessionStorage.removeItem("householdos_action_skew_reload_attempted");
                  sessionStorage.removeItem("householdos_action_skew_reload_deploy");
                } catch {
                  // ignore
                }
                window.location.assign(
                  `${window.location.pathname}?_hos_dpl=${Date.now()}`,
                );
              }}
            >
              Reload latest version
            </button>
            <a href="/login" className={recoveryControlClass.secondary}>
              Return to sign in
            </a>
          </>
        }
      />
    </div>
  );
}
