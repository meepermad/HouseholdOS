/** Non-secret build identifiers for diagnostics and skew recovery. */

export type AppBuildInfo = {
  commitSha: string;
  deploymentId: string;
  skewProtectionEnabled: boolean;
};

export function getServerBuildInfo(): AppBuildInfo {
  const commit =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
    "local";
  const deployment =
    process.env.VERCEL_DEPLOYMENT_ID ??
    process.env.NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID ??
    "local";
  return {
    commitSha: commit.slice(0, 7),
    deploymentId: deployment.slice(0, 12),
    skewProtectionEnabled: process.env.VERCEL_SKEW_PROTECTION_ENABLED === "1",
  };
}

/** Values safe to embed in client HTML (no secrets). */
export function getPublicBuildInfo(): AppBuildInfo {
  return getServerBuildInfo();
}
