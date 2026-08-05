import Link from "next/link";
import { redirect } from "next/navigation";
import {
  PasswordField,
  PasswordRequirements,
} from "@/components/auth/password-field";
import {
  isRecoveryAuthErrorCode,
  mapRecoveryAuthErrorMessage,
} from "@/lib/auth/password-recovery";
import { createClient } from "@/lib/supabase/server";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?error=session_expired");
  }

  const errorCode = isRecoveryAuthErrorCode(params.error) ? params.error : null;

  return (
    <main className="safe-pt safe-pb mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <p className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-text-primary">
        HouseholdOS
      </p>
      <h1 className="mt-6 text-xl font-semibold text-text-primary">
        Choose a new password
      </h1>
      <p className="mt-2 text-sm text-text-secondary">
        After updating, you will sign in with the new password. Other sessions
        are signed out where supported.
      </p>

      {errorCode ? (
        <p
          className="mt-4 text-sm text-destructive"
          role="alert"
          data-testid="reset-password-error"
        >
          {mapRecoveryAuthErrorMessage(errorCode)}
        </p>
      ) : null}

      <form
        method="post"
        action="/api/auth/reset-password"
        className="mt-8 space-y-4"
        data-testid="reset-password-form"
      >
        <PasswordField
          name="password"
          label="New password"
          autoComplete="new-password"
          id="reset-password"
        />
        <PasswordField
          name="confirmPassword"
          label="Confirm password"
          autoComplete="new-password"
          id="reset-confirm"
        />
        <PasswordRequirements />
        <button
          type="submit"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          Update password
        </button>
      </form>

      <p className="mt-6 text-sm text-text-secondary">
        Link expired?{" "}
        <Link
          href="/forgot-password"
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          Request a new reset link
        </Link>
      </p>
    </main>
  );
}
