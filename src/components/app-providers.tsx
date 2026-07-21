import { ThemeProvider } from "@/components/theme-provider";
import { OfflineBanner } from "@/components/offline-banner";
import { OfflineLifecycle } from "@/components/offline-lifecycle";
import { ServiceWorkerUpdateBanner } from "@/components/sw-update-banner";
import { ChunkLoadRecovery } from "@/components/chunk-load-recovery";
import { DeploymentSkewRecovery } from "@/components/deployment-skew-recovery";
import { persistThemePreferenceAction } from "@/app/actions/preferences";
import { getPublicBuildInfo } from "@/lib/build-info";

/**
 * Keep this synchronous. Awaiting auth/theme here blocked the entire document
 * (including loading UI and recovery) whenever getUser() stalled.
 * Theme still applies from localStorage via ThemeBootstrapScript + ThemeProvider.
 */
export function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  const build = getPublicBuildInfo();

  return (
    <ThemeProvider
      databaseTheme={null}
      persistAction={persistThemePreferenceAction}
    >
      <ChunkLoadRecovery />
      <DeploymentSkewRecovery silent deployMarker={build.deploymentId} />
      <OfflineBanner />
      <OfflineLifecycle />
      <ServiceWorkerUpdateBanner buildLabel={build.commitSha} />
      {children}
    </ThemeProvider>
  );
}
