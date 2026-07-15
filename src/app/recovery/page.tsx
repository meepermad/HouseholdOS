/* eslint-disable @next/next/no-html-link-for-pages -- recovery UI must remain shell-independent */
import {
  RecoveryClearHouseholdForm,
  RecoveryLogoutForm,
} from "@/components/recovery-actions";
import {
  classifyRecoveryReason,
  formatErrorReference,
  recoveryCopy,
} from "@/lib/recovery";

export const dynamic = "force-dynamic";

export default async function RecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; ref?: string }>;
}) {
  const params = await searchParams;
  const state = classifyRecoveryReason(params.reason);
  const copy = recoveryCopy(state);
  const reference = formatErrorReference(params.ref);

  return (
    <main
      style={{
        minHeight: "100dvh",
        maxWidth: "28rem",
        margin: "0 auto",
        padding: "2.5rem 1.25rem",
        fontFamily: "system-ui, sans-serif",
        color: "#142033",
        background: "linear-gradient(180deg, #f7f3ea 0%, #efe6d6 100%)",
      }}
    >
      <p
        style={{
          fontSize: "1.5rem",
          fontWeight: 600,
          letterSpacing: "-0.02em",
        }}
      >
        HouseholdOS
      </p>
      <h1 style={{ marginTop: "1.5rem", fontSize: "1.25rem" }}>{copy.title}</h1>
      <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#475569" }}>
        {copy.body}
      </p>
      {reference ? (
        <p
          style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "#64748b" }}
          data-testid="recovery-reference"
        >
          Reference: {reference}
        </p>
      ) : null}

      <div
        style={{
          marginTop: "1.75rem",
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <a
          href="/app"
          style={{
            display: "inline-block",
            padding: "0.6rem 1rem",
            borderRadius: "0.375rem",
            background: "#1f6f5b",
            color: "#fff",
            fontSize: "0.875rem",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Return to HouseholdOS
        </a>
        <a
          href="/recovery"
          style={{
            display: "inline-block",
            padding: "0.6rem 1rem",
            borderRadius: "0.375rem",
            border: "1px solid #d9d2c3",
            background: "#fffdf8",
            color: "#142033",
            fontSize: "0.875rem",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Try again
        </a>
      </div>

      <div style={{ marginTop: "1.25rem" }}>
        <RecoveryClearHouseholdForm next="/app" />
        <RecoveryLogoutForm />
      </div>

      <p style={{ marginTop: "1.5rem", fontSize: "0.875rem" }}>
        <a href="/login" style={{ color: "#1f6f5b" }}>
          Go to sign in
        </a>
        {" · "}
        <a href="/onboarding" style={{ color: "#1f6f5b" }}>
          Onboarding
        </a>
      </p>
    </main>
  );
}
