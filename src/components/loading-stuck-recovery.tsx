"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STUCK_MS = 8_000;

/**
 * If the household shell stays on the loading skeleton too long after a hard
 * navigation (post-login), offer an explicit reload instead of an infinite wait.
 */
export function LoadingStuckRecovery({
  label = "Loading household dashboard",
}: {
  label?: string;
}) {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setStuck(true), STUCK_MS);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    try {
      sessionStorage.removeItem("householdos:chunk-load-reload");
    } catch {
      // ignore
    }
  }, []);

  if (!stuck) return null;

  return (
    <div
      className="mt-6 rounded-md border border-border bg-surface px-4 py-3"
      role="status"
      data-testid="loading-stuck-recovery"
    >
      <p className="text-sm font-medium text-text-primary">
        Still loading {label.toLowerCase()}…
      </p>
      <p className="mt-1 text-sm text-text-secondary">
        You may already be signed in. Reload this page, or return to Home.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          onClick={() => window.location.reload()}
        >
          Reload page
        </button>
        <Link
          href="/app"
          className="inline-flex min-h-11 items-center rounded-md border border-border px-4 py-2 text-sm font-semibold text-text-primary"
        >
          Choose household
        </Link>
      </div>
    </div>
  );
}
