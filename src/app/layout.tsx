import { Fraunces, Source_Sans_3 } from "next/font/google";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { ThemeBootstrapScript } from "@/components/theme-bootstrap-script";
import { DocumentLoadWatchdogScript } from "@/components/document-load-watchdog-script";
import { AppProviders } from "@/components/app-providers";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HouseholdOS",
  description:
    "Private household management for expenses, ownership, responsibilities, and commitments.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    // Pair with viewportFit cover so content draws under the status bar safely.
    statusBarStyle: "black-translucent",
    title: "HouseholdOS",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3efe6" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1419" },
  ],
  width: "device-width",
  initialScale: 1,
  // Allow zoom for accessibility on money inputs and forms.
  maximumScale: 5,
  // Required for env(safe-area-inset-*) on notched iPhones.
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${sourceSans.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <ThemeBootstrapScript nonce={nonce} />
        <DocumentLoadWatchdogScript nonce={nonce} />
      </head>
      <body
        className="min-h-full bg-background antialiased text-text-primary"
        data-server-document-rendered="true"
      >
        {/*
          Do not wrap {children} in a root Suspense fallback.
          A root Suspense + CSP that blocks inline $RC scripts leaves the
          fallback mounted forever while completed Home HTML stays hidden
          in #S:* slots. Nested route Suspense remains for section streaming.
        */}
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
