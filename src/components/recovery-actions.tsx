/* eslint-disable @next/next/no-html-link-for-pages -- shell-independent recovery anchors */

import type { ReactNode } from "react";
import { recoveryControlClass } from "@/components/recovery-screen";

/**
 * Standalone recovery actions — safe for error boundaries and global-error.
 * Uses semantic token classes (globals.css must be available; global-error imports it).
 */

export function RecoveryLogoutForm({
  label = "Sign out",
  variant = "primary",
}: {
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const className =
    variant === "ghost"
      ? recoveryControlClass.ghost
      : variant === "secondary"
        ? recoveryControlClass.secondary
        : recoveryControlClass.primary;

  return (
    <form action="/auth/logout" method="post" className="inline">
      <button type="submit" className={className} aria-label={label}>
        {label}
      </button>
    </form>
  );
}

export function RecoveryClearHouseholdForm({
  label = "Clear household selection",
  next = "/app",
}: {
  label?: string;
  next?: string;
}) {
  return (
    <form action="/auth/clear-household" method="post" className="inline">
      <input type="hidden" name="next" value={next} />
      <button
        type="submit"
        className={recoveryControlClass.ghost}
        aria-label={label}
      >
        {label}
      </button>
    </form>
  );
}

export function RecoveryLinks({
  showLogin = false,
  showRecovery = true,
  showHome = false,
}: {
  showLogin?: boolean;
  showRecovery?: boolean;
  showHome?: boolean;
}) {
  const parts: ReactNode[] = [];

  if (showHome) {
    parts.push(
      <a key="home" href="/app" className={recoveryControlClass.link}>
        Go to app
      </a>,
    );
  }
  if (showRecovery) {
    parts.push(
      <a key="recovery" href="/recovery" className={recoveryControlClass.link}>
        Recovery options
      </a>,
    );
  }
  if (showLogin) {
    parts.push(
      <a key="login" href="/login" className={recoveryControlClass.link}>
        Sign in
      </a>,
    );
  }

  if (parts.length === 0) return null;

  return (
    <>
      {parts.map((part, index) => (
        <span key={index}>
          {index > 0 ? <span className="mx-2 text-text-muted">·</span> : null}
          {part}
        </span>
      ))}
    </>
  );
}
