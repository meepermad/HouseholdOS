import Link from "next/link";
import {
  GENERIC_FORGOT_SUCCESS,
  isRecoveryAuthErrorCode,
  mapRecoveryAuthErrorMessage,
} from "@/lib/auth/password-recovery";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const params = await searchParams;
  const errorCode = isRecoveryAuthErrorCode(params.error) ? params.error : null;
  const sent = params.sent === "1";

  return (
    <main className="safe-pt safe-pb mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <p className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-text-primary">
        HouseholdOS
      </p>
      <h1 className="mt-6 text-xl font-semibold text-text-primary">
        Forgot password
      </h1>
      <p className="mt-2 text-sm text-text-secondary">
        Enter your email. If an account exists, we will send a reset link to the
        official HouseholdOS site — not a local address.
      </p>

      {sent ? (
        <p
          className="mt-6 rounded-md border border-border bg-surface px-4 py-3 text-sm text-success"
          role="status"
          data-testid="forgot-password-success"
        >
          {GENERIC_FORGOT_SUCCESS}
        </p>
      ) : null}

      {errorCode ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {mapRecoveryAuthErrorMessage(errorCode)}
        </p>
      ) : null}

      <form
        method="post"
        action="/api/auth/forgot-password"
        className="mt-8 space-y-4"
        data-testid="forgot-password-form"
      >
        <label className="block text-sm text-text-primary" htmlFor="forgot-email">
          Email
          <input
            id="forgot-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded-md border border-border bg-input-bg px-3 py-2 text-text-primary"
          />
        </label>
        <button
          type="submit"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          Send reset link
        </button>
      </form>

      <p className="mt-6 text-sm text-text-secondary">
        <Link
          href="/login"
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
