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

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || pending || redirecting) return;
    submitting.current = true;
    setError(null);
    setActionHref(null);
    setActionLabel(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const nextValue = String(formData.get("next") ?? next);

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
              error: "Sign-in failed. Try again.",
            };
          }
          if (!body.ok) {
            setError(body.error || "Sign-in failed. Try again.");
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
    <form className="mt-8 space-y-4" noValidate onSubmit={onSubmit}>
      <fieldset disabled={busy} className="contents">
        <input type="hidden" name="next" value={next} />
        <label className="block text-sm text-text-primary">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 min-h-11 w-full rounded-md border border-border bg-input-bg px-3 py-2"
          />
        </label>
        <label className="block text-sm text-text-primary">
          Password
          <input
            name="password"
            type="password"
            required
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
          className="w-full min-h-11 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
        >
          Sign in
        </button>
      </fieldset>
      {error ? (
        <div className="space-y-1" role="alert">
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
