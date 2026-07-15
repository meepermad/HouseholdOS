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
            url.pathname.startsWith("/join")),
        handler: "NetworkOnly",
      },
    ],
  },
});

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
};

export default withPWA(nextConfig);
