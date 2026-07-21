"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";

type SignInResponse =
  | { ok: true; redirectTo: string }
  | {
      ok: false;
      error: string;
      category?: string;
      actionHref?: string;
      actionLabel?: string;
    };

const TIMEOUT_MS = 25_000;

function messageForHttpStatus(status: number): string {
  if (status === 401) {
    return "Unable to sign in with those credentials. If you just reset your password, use the new password (not the old one).";
  }
  if (status === 403) {
    return "Sign-in was blocked for security. Open https://household-os-five.vercel.app/login in a fresh tab and try again.";
  }
  if (status === 400 || status === 413 || status === 415) {
    return "Enter a valid email and a password of at least 8 characters.";
  }
  if (status === 429) {
    return "Too many sign-in attempts. Wait a minute and try again.";
  }
  return "Sign-in failed. Try again.";
}

export function LoginForm({
  next,
}: {
  next: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [actionHref, setActionHref] = useState<string | null>(null);
  const [actionLabel, setActionLabel] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [redirecting, setRedirecting] = useState(false);
  const submitting = useRef(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting.current || pending || redirecting) {
      return;
    }

    submitting.current = true;
    setError(null);
    setActionHref(null);
    setActionLabel(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const nextValue = String(formData.get("next") ?? next);

    if (!email || !email.includes("@")) {
      setError("Enter a valid email address.");
      submitting.current = false;
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      submitting.current = false;
      return;
    }

    startTransition(() => {
      void (async () => {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
          const res = await fetch("/api/auth/sign-in", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              accept: "application/json",
            },
            body: JSON.stringify({
              email,
              password,
              next: nextValue,
            }),
            credentials: "same-origin",
            signal: controller.signal,
          });
          let body: SignInResponse;
          try {
            body = (await res.json()) as SignInResponse;
          } catch {
            body = {
              ok: false,
              error: messageForHttpStatus(res.status),
            };
          }
          if (!body.ok) {
            setError(
              body.error || messageForHttpStatus(res.status) || "Sign-in failed. Try again.",
            );
            if (body.actionHref) setActionHref(body.actionHref);
            if (body.actionLabel) setActionLabel(body.actionLabel);
            return;
          }
          setRedirecting(true);
          window.location.assign(body.redirectTo);
        } catch (err) {
          const aborted =
            err instanceof DOMException && err.name === "AbortError";
          setError(
            aborted
              ? "Sign-in timed out. Check your connection and try again."
              : "Sign-in failed. Try again.",
          );
        } finally {
          window.clearTimeout(timer);
          submitting.current = false;
        }
      })();
    });
  }

  const busy = pending || redirecting;

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
          disabled={busy}
          className="mt-1 min-h-11 w-full rounded-md border border-border bg-input-bg px-3 py-2 disabled:opacity-60"
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
          disabled={busy}
          className="mt-1 min-h-11 w-full rounded-md border border-border bg-input-bg px-3 py-2 disabled:opacity-60"
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
        disabled={busy}
        className="w-full min-h-11 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        Sign in
      </button>
      {error ? (
        <div className="space-y-2" role="alert">
          <p className="text-sm text-destructive">{error}</p>
          {actionHref ? (
            <p className="text-sm">
              <Link
                href={actionHref}
                className="font-medium text-primary underline underline-offset-2"
              >
                {actionLabel ?? "Open related item"}
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}
      {busy ? (
        <p className="text-sm text-text-muted" aria-live="polite" role="status">
          {redirecting ? "Opening HouseholdOS…" : "Signing in…"}
        </p>
      ) : null}
    </form>
  );
}
