"use client";

import { useEffect, useRef } from "react";
import "@/app/globals.css";
import {
  RecoveryClearHouseholdForm,
  RecoveryLinks,
  RecoveryLogoutForm,
} from "@/components/recovery-actions";
import { RecoveryScreen, recoveryControlClass } from "@/components/recovery-screen";
import { formatErrorReference } from "@/lib/recovery";

/**
 * Last-resort error UI. Defines its own html/body but imports globals so
 * light/dark tokens match the rest of HouseholdOS.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const reference = formatErrorReference(error.digest);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("householdos-theme");
      const mode =
        raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
      const dark =
        mode === "dark" ||
        (mode === "system" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    } catch {
      /* private mode */
    }
    headingRef.current?.focus();
  }, []);

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <RecoveryScreen
          headingRef={headingRef}
          title="Application error"
          body="A critical error interrupted this page. Retry, open recovery, or sign out. No household data is deleted by these actions."
          reference={reference}
          primary={
            <>
              <button
                type="button"
                onClick={reset}
                aria-label="Try again"
                className={recoveryControlClass.primary}
              >
                Try again
              </button>
              <RecoveryLogoutForm variant="secondary" />
            </>
          }
          secondary={<RecoveryClearHouseholdForm />}
          footer={<RecoveryLinks showLogin showRecovery />}
        />
      </body>
    </html>
  );
}
