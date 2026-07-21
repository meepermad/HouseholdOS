/** True when the client invoked a Server Action ID from another deploy. */
export function isDeploymentSkewError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message =
    "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  return (
    message.includes("Failed to find Server Action") ||
    message.includes("older or newer deployment")
  );
}

const RELOAD_KEY = "householdos:deployment-skew-reload";

/** Reload once per tab to pick up the live deploy; avoid loops if skew persists. */
export function reloadOnceForDeploymentSkew(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem(RELOAD_KEY) === "1") return false;
    sessionStorage.setItem(RELOAD_KEY, "1");
  } catch {
    // sessionStorage blocked — still attempt a single reload.
  }
  window.location.reload();
  return true;
}
