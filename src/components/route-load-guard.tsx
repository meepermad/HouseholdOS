"use client";

import { useEffect, useState } from "react";
import {
  RecoveryLogoutForm,
} from "@/components/recovery-actions";
import { RecoveryScreen, recoveryControlClass } from "@/components/recovery-screen";
import { Skeleton } from "@/components/ui/skeleton";
import {
  loadStageLabel,
  type LoadStage,
} from "@/lib/async/with-deadline";
import { getPublicBuildInfo } from "@/lib/build-info";

const STUCK_MS = 7_000;

function stageBody(stage: LoadStage): string {
  switch (stage) {
    case "profile":
      return "Profile setup did not finish in time. You may already be signed in.";
    case "household_shell":
      return "The household shell did not finish loading in time.";
    case "home":
      return "Home content did not finish loading in time. The household shell may still be usable after reload.";
    default:
      return "HouseholdOS did not finish loading in time. You may already be signed in.";
  }
}

/**
 * Suspense/loading fallback that never stays indefinite.
 * After STUCK_MS, replaces the skeleton with a full recovery screen.
 */
export function RouteLoadGuard({
  stage = "app",
  label,
}: {
  stage?: LoadStage;
  /** Optional aria/skeleton label override. */
  label?: string;
}) {
  const [stuck, setStuck] = useState(false);
  const build = getPublicBuildInfo();
  const reference = `load-${stage}-${build.commitSha}`;
  const aria = label ?? `Loading ${loadStageLabel(stage).toLowerCase()}`;

  useEffect(() => {
    const id = window.setTimeout(() => setStuck(true), STUCK_MS);
    return () => window.clearTimeout(id);
  }, []);

  if (stuck) {
    return (
      <RecoveryScreen
        testId="route-load-guard-recovery"
        title={`${loadStageLabel(stage)} is taking too long`}
        body={stageBody(stage)}
        reference={reference}
        primary={
          <>
            <button
              type="button"
              className={recoveryControlClass.primary}
              data-testid="route-load-guard-retry"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
            <button
              type="button"
              className={recoveryControlClass.secondary}
              data-testid="route-load-guard-reload-latest"
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.set("_hos_dpl", String(Date.now()));
                window.location.assign(url.toString());
              }}
            >
              Reload latest version
            </button>
            <a href="/app" className={recoveryControlClass.secondary}>
              Choose household
            </a>
            <RecoveryLogoutForm variant="secondary" />
          </>
        }
      />
    );
  }

  return (
    <div
      className="space-y-6"
      aria-busy="true"
      aria-label={aria}
      data-testid="route-load-guard"
      data-load-stage={stage}
    >
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}
