import type { Metadata, Viewport } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { ThemeBootstrapScript } from "@/components/theme-bootstrap-script";
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
    statusBarStyle: "default",
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${sourceSans.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <ThemeBootstrapScript />
      </head>
      <body className="min-h-full antialiased text-text-primary">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
