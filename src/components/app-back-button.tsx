"use client";

import { useRouter } from "next/navigation";

/** In-app back control for standalone PWA where browser chrome is absent. */
export function AppBackButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      className="standalone-only mb-3 inline-flex min-h-11 items-center text-sm font-medium text-text-secondary underline"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
        } else {
          router.push(fallbackHref);
        }
      }}
    >
      Back
    </button>
  );
}
