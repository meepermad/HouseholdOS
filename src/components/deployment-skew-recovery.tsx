"use client";

import { useEffect } from "react";
import {
  isDeploymentSkewError,
  reloadOnceForDeploymentSkew,
} from "@/lib/deployment-skew";

/** One-shot hard reload when a Server Action ID does not match this deploy. */
export function DeploymentSkewRecovery({ error }: { error: unknown }) {
  useEffect(() => {
    if (isDeploymentSkewError(error)) {
      reloadOnceForDeploymentSkew();
    }
  }, [error]);

  return null;
}
