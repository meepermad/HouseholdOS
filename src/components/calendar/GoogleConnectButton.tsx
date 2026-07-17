"use client";

import { useState, useTransition } from "react";
import { startGoogleCalendarOAuthAction } from "@/app/actions/calendar";

export function GoogleConnectButton({ householdId }: { householdId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await startGoogleCalendarOAuthAction(householdId);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            const url = result.data?.authUrl;
            if (url) {
              window.location.href = url;
            }
          });
        }}
      >
        {pending ? "Starting…" : "Connect Google Calendar"}
      </button>
      {error ? (
        <p className="text-sm text-amber-700 dark:text-amber-400" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}
