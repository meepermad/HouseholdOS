import { ThemeProvider } from "@/components/theme-provider";
import { OfflineBanner } from "@/components/offline-banner";
import { OfflineLifecycle } from "@/components/offline-lifecycle";
import { ServiceWorkerUpdateBanner } from "@/components/sw-update-banner";
import { ChunkLoadRecovery } from "@/components/chunk-load-recovery";
import { DeploymentSkewRecovery } from "@/components/deployment-skew-recovery";
import { getAuthenticatedThemePreference } from "@/lib/theme/server";
import { persistThemePreferenceAction } from "@/app/actions/preferences";
import { getPublicBuildInfo } from "@/lib/build-info";

export async function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  const databaseTheme = await getAuthenticatedThemePreference();
  const build = getPublicBuildInfo();

  return (
    <ThemeProvider
      databaseTheme={databaseTheme}
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
