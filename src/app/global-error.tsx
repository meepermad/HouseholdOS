"use client";

import { useEffect, useRef } from "react";
import {
  RecoveryClearHouseholdForm,
  RecoveryLinks,
  RecoveryLogoutForm,
} from "@/components/recovery-actions";
import { formatErrorReference } from "@/lib/recovery";

/**
 * Last-resort error UI. Must define its own html/body and avoid importing
 * the root layout, shell, providers, or complex app components.
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
    headingRef.current?.focus();
  }, []);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          fontFamily: "system-ui, sans-serif",
          color: "#142033",
          background: "#f3efe6",
        }}
      >
        <main
          style={{
            maxWidth: "28rem",
            margin: "0 auto",
            padding: "2.5rem 1.25rem",
          }}
        >
          <p style={{ fontSize: "1.25rem", fontWeight: 600 }}>HouseholdOS</p>
          <h1
            ref={headingRef}
            tabIndex={-1}
            style={{ marginTop: "1rem", fontSize: "1.25rem", outline: "none" }}
          >
            Application error
          </h1>
          <p
            role="status"
            aria-live="polite"
            style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#475569" }}
          >
            A critical error interrupted this page. Retry, open recovery, or sign
            out. No household data is deleted by these actions.
          </p>
          {reference ? (
            <p style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "#94a3b8" }}>
              Reference: {reference}
            </p>
          ) : null}

          <div style={{ marginTop: "1.5rem" }}>
            <button
              type="button"
              onClick={reset}
              aria-label="Try again"
              style={{
                marginRight: "0.5rem",
                padding: "0.6rem 1rem",
                borderRadius: "0.375rem",
                border: "1px solid #1f6f5b",
                background: "#1f6f5b",
                color: "#fff",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <RecoveryClearHouseholdForm />
            <RecoveryLogoutForm />
          </div>

          <RecoveryLinks showLogin />
        </main>
      </body>
    </html>
  );
}
