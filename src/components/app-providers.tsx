import { ThemeProvider } from "@/components/theme-provider";
import { OfflineBanner } from "@/components/offline-banner";
import { OfflineLifecycle } from "@/components/offline-lifecycle";
import { ServiceWorkerUpdateBanner } from "@/components/sw-update-banner";
import { ChunkLoadRecovery } from "@/components/chunk-load-recovery";
import { getAuthenticatedThemePreference } from "@/lib/theme/server";
import { persistThemePreferenceAction } from "@/app/actions/preferences";

export async function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  const databaseTheme = await getAuthenticatedThemePreference();

  return (
    <ThemeProvider
      databaseTheme={databaseTheme}
      persistAction={persistThemePreferenceAction}
    >
      <ChunkLoadRecovery />
      <OfflineBanner />
      <OfflineLifecycle />
      <ServiceWorkerUpdateBanner />
      {children}
    </ThemeProvider>
  );
}
