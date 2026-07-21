"use client";

import Link from "next/link";
import { useRef, useState } from "react";

/**
 * Password login uses native form POST → 303 + Set-Cookie for an atomic
 * session handoff. Fetch+JSON can set cookies then navigate separately, which
 * left some clients on /app/{id} with a stuck loading shell.
 */
export function LoginForm({
  next,
}: {
  next: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const lock = useRef(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    // Validate first; on success allow the browser to POST (do not preventDefault).
    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (lock.current || submitting) {
      event.preventDefault();
      return;
    }

    if (!email || !email.includes("@")) {
      event.preventDefault();
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      event.preventDefault();
      setError("Password must be at least 8 characters.");
      return;
    }

    // Sync the trimmed email into the field so the native POST body is clean.
    const emailInput = form.elements.namedItem("email");
    if (emailInput instanceof HTMLInputElement) {
      emailInput.value = email;
    }

    lock.current = true;
    setError(null);
    setSubmitting(true);
    // Native submit: POST /api/auth/sign-in → 303 Location + session cookies.
  }

  return (
    <form
      method="post"
      action="/api/auth/sign-in"
      className="mt-8 space-y-4"
      noValidate
      onSubmit={handleSubmit}
      data-testid="login-form"
    >
      <input type="hidden" name="next" value={next} />
      <label className="block text-sm text-text-primary">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          className="mt-1 min-h-11 w-full rounded-md border border-border bg-input-bg px-3 py-2"
        />
      </label>
      <label className="block text-sm text-text-primary">
        Password
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="current-password"
          className="mt-1 min-h-11 w-full rounded-md border border-border bg-input-bg px-3 py-2"
        />
      </label>
      <p className="text-sm">
        <Link
          href="/forgot-password"
          className="text-text-secondary underline-offset-2 hover:underline"
        >
          Forgot password?
        </Link>
      </p>
      <button
        type="submit"
        disabled={submitting}
        className="w-full min-h-11 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {submitting ? "Signing in…" : "Sign in"}
      </button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {submitting ? (
        <p className="text-sm text-text-muted" aria-live="polite" role="status">
          Opening HouseholdOS…
        </p>
      ) : null}
    </form>
  );
}
