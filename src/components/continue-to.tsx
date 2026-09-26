"use client";

import { useEffect } from "react";

/**
 * Full navigation without `redirect()`.
 * Next's client Router throws "Rendered more hooks than during the previous
 * render" when it hydrates a server `redirect()` from `/app`.
 */
export function ContinueTo({ href }: { href: string }) {
  useEffect(() => {
    window.location.replace(href);
  }, [href]);

  return (
    <main className="px-4 py-8">
      <p className="text-sm text-text-muted" role="status">
        Opening HouseholdOS…
      </p>
      <p className="mt-3 text-sm">
        <a className="font-medium text-primary underline underline-offset-2" href={href}>
          Continue
        </a>
      </p>
    </main>
  );
}
