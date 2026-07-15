import { ThemeProvider } from "@/components/theme-provider";
import { OfflineBanner } from "@/components/offline-banner";
import { ServiceWorkerUpdateBanner } from "@/components/sw-update-banner";
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
      <OfflineBanner />
      <ServiceWorkerUpdateBanner />
      {children}
    </ThemeProvider>
  );
}
