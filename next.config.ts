import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  customWorkerSrc: "worker",
  // Do not aggressively cache authenticated household navigations.
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: ({ request, url }: { request: Request; url: URL }) =>
          request.mode === "navigate" &&
          (url.pathname.startsWith("/app") ||
            url.pathname.startsWith("/onboarding") ||
            url.pathname.startsWith("/join") ||
            url.pathname === "/login" ||
            url.pathname.startsWith("/login") ||
            url.pathname === "/signup" ||
            url.pathname.startsWith("/signup") ||
            url.pathname === "/recovery" ||
            url.pathname.startsWith("/recovery") ||
            url.pathname === "/forgot-password" ||
            url.pathname.startsWith("/forgot-password") ||
            url.pathname === "/reset-password" ||
            url.pathname.startsWith("/reset-password")),
        handler: "NetworkOnly",
      },
      {
        // Never cache the stable auth Route Handler.
        urlPattern: ({ url }: { url: URL }) =>
          url.pathname.startsWith("/api/auth/"),
        handler: "NetworkOnly",
      },
      {
        // Cache OCR language/worker assets; never cache private receipt images.
        urlPattern: ({ url }: { url: URL }) =>
          url.pathname.startsWith("/ocr/") ||
          url.pathname.startsWith("/pdfjs/"),
        handler: "CacheFirst",
        options: {
          cacheName: "householdos-ocr-assets",
          expiration: {
            maxEntries: 32,
            maxAgeSeconds: 60 * 60 * 24 * 30,
          },
        },
      },
    ],
  },
});

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async headers() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    let supabaseOrigin = "";
    try {
      supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : "";
    } catch {
      supabaseOrigin = "";
    }
    const connectSrc = [
      "'self'",
      supabaseOrigin,
      "https://*.supabase.co",
      "wss://*.supabase.co",
    ]
      .filter(Boolean)
      .join(" ");
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      // Next.js + Tesseract WASM need unsafe-eval in workers; keep script self + blob workers
      "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' blob:",
      "worker-src 'self' blob:",
      `connect-src ${connectSrc}`,
      "media-src 'self' blob:",
      "manifest-src 'self'",
    ].join("; ");

    const globalHeaders = [
      { key: "Content-Security-Policy", value: csp },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(self), microphone=(), geolocation=()",
      },
      { key: "X-Frame-Options", value: "DENY" },
    ];

    const authNoStore = [
      { key: "Cache-Control", value: "no-store" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Content-Type-Options", value: "nosniff" },
    ];

    const authPaths = [
      "/login",
      "/signup",
      "/forgot-password",
      "/reset-password",
      "/recovery",
    ];

    return [
      {
        source: "/:path*",
        headers: globalHeaders,
      },
      ...authPaths.map((source) => ({
        source,
        headers: authNoStore,
      })),
    ];
  },
};

export default withPWA(nextConfig);
