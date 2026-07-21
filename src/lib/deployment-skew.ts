/** True when the client invoked a Server Action ID from another deploy. */
export function isDeploymentSkewError(error: unknown): boolean {
  if (!error || typeof error === "string") {
    const message = typeof error === "string" ? error : "";
    return (
      message.includes("Failed to find Server Action") ||
      message.includes("older or newer deployment")
    );
  }
  if (!error || typeof error !== "object") return false;
  const message =
    "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  const digest =
    "digest" in error && typeof error.digest === "string" ? error.digest : "";
  return (
    message.includes("Failed to find Server Action") ||
    message.includes("older or newer deployment") ||
    digest.includes("NEXT_NOT_FOUND_ACTION") ||
    digest.includes("Failed to find Server Action")
  );
}

export const SKEW_RELOAD_KEY = "householdos_action_skew_reload_attempted";
export const SKEW_RELOAD_DEPLOY_KEY = "householdos_action_skew_reload_deploy";

/** One hard reload per deployment mismatch; returns false if already attempted. */
export function reloadOnceForDeploymentSkew(deployMarker?: string): boolean {
  if (typeof window === "undefined") return false;
  const marker = deployMarker || "unknown";
  try {
    if (sessionStorage.getItem(SKEW_RELOAD_KEY) === "1") {
      const prior = sessionStorage.getItem(SKEW_RELOAD_DEPLOY_KEY);
      if (prior === marker) return false;
    }
    sessionStorage.setItem(SKEW_RELOAD_KEY, "1");
    sessionStorage.setItem(SKEW_RELOAD_DEPLOY_KEY, marker);
  } catch {
    // sessionStorage blocked — still attempt a single reload.
  }
  const url = new URL(window.location.href);
  url.searchParams.set("_hos_dpl", marker);
  window.location.replace(url.toString());
  return true;
}

export function hasExhaustedSkewReload(deployMarker?: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem(SKEW_RELOAD_KEY) !== "1") return false;
    const prior = sessionStorage.getItem(SKEW_RELOAD_DEPLOY_KEY);
    return !deployMarker || prior === deployMarker;
  } catch {
    return false;
  }
}
