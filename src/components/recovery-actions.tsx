/* eslint-disable @next/next/no-html-link-for-pages -- shell-independent recovery anchors */

/**
 * Standalone recovery action forms — no shell, ActionForm, or heavy imports.
 * Safe to render from error boundaries and global-error.
 * Neutrally styled for light and dark readability without depending on the app shell.
 */

type Style = Record<string, string | number>;

const buttonStyle: Style = {
  display: "inline-block",
  marginTop: "0.5rem",
  marginRight: "0.5rem",
  minHeight: "2.75rem",
  padding: "0.6rem 1rem",
  borderRadius: "0.375rem",
  border: "1px solid #6b7280",
  background: "transparent",
  color: "inherit",
  fontSize: "0.875rem",
  fontWeight: 600,
  cursor: "pointer",
  textDecoration: "none",
};

const primaryStyle: Style = {
  ...buttonStyle,
  background: "#1f6f5b",
  borderColor: "#1f6f5b",
  color: "#fff",
};

export function RecoveryLogoutForm({ label = "Sign out" }: { label?: string }) {
  return (
    <form action="/auth/logout" method="post" style={{ display: "inline" }}>
      <button type="submit" style={primaryStyle} aria-label={label}>
        {label}
      </button>
    </form>
  );
}

export function RecoveryClearHouseholdForm({
  label = "Clear selected household",
  next = "/app",
}: {
  label?: string;
  next?: string;
}) {
  return (
    <form action="/auth/clear-household" method="post" style={{ display: "inline" }}>
      <input type="hidden" name="next" value={next} />
      <button type="submit" style={buttonStyle} aria-label={label}>
        {label}
      </button>
    </form>
  );
}

export function RecoveryLinks({
  showLogin = false,
}: {
  showLogin?: boolean;
}) {
  return (
    <p style={{ marginTop: "1rem", fontSize: "0.875rem" }}>
      <a href="/recovery" style={{ color: "#1f6f5b" }}>
        Recovery options
      </a>
      {" · "}
      <a href="/app" style={{ color: "#1f6f5b" }}>
        Return to HouseholdOS
      </a>
      {showLogin ? (
        <>
          {" · "}
          <a href="/login" style={{ color: "#1f6f5b" }}>
            Sign in
          </a>
        </>
      ) : null}
    </p>
  );
}
