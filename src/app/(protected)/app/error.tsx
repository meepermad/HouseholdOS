"use client";

import { useEffect, useRef } from "react";
import {
  RecoveryClearHouseholdForm,
  RecoveryLinks,
  RecoveryLogoutForm,
} from "@/components/recovery-actions";
import { formatErrorReference } from "@/lib/recovery";

export default function ProtectedAppError({
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
    <main
      style={{
        minHeight: "100dvh",
        maxWidth: "28rem",
        margin: "0 auto",
        padding: "2.5rem 1.25rem",
        fontFamily: "system-ui, sans-serif",
        color: "#142033",
      }}
      data-testid="protected-error-boundary"
    >
      <h1
        ref={headingRef}
        tabIndex={-1}
        style={{ fontSize: "1.25rem", fontWeight: 600, outline: "none" }}
      >
        Could not load this screen
      </h1>
      <p
        role="status"
        aria-live="polite"
        style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#475569" }}
      >
        Retry this page, clear your selected household, open recovery options, or
        sign out. These actions do not delete expenses or reimbursements.
      </p>
      {reference ? (
        <p
          style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "#94a3b8" }}
          data-testid="error-reference"
        >
          Reference: {reference}
        </p>
      ) : null}

      <div style={{ marginTop: "1.5rem" }}>
        <button
          type="button"
          onClick={reset}
          aria-label="Try again"
          data-testid="error-retry"
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
  );
}
