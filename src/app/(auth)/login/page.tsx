import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { signInAction } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/navigation";
import {
  classifyRecoveryReason,
  recoveryCopy,
  safeRecoveryDestination,
} from "@/lib/recovery";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; reason?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && params.reason !== "signed_out") {
    redirect(safeRecoveryDestination(params.next));
  }

  const next = safeRedirectPath(params.next, "/app");
  const reasonState = classifyRecoveryReason(params.reason);
  const reasonCopy =
    params.reason && reasonState !== "unexpected"
      ? recoveryCopy(reasonState)
      : null;

  return (
    <main className="safe-pt safe-pb mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <p className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-text-primary">
        HouseholdOS
      </p>
      <h1 className="mt-6 text-xl font-semibold text-text-primary">Sign in</h1>
      <p className="mt-2 text-sm text-text-secondary">
        No account?{" "}
        <Link
          href={`/signup?next=${encodeURIComponent(next)}`}
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          Request access
        </Link>
      </p>

      {reasonCopy ? (
        <div
          className="mt-6 rounded-md border border-border bg-surface px-4 py-3"
          role="status"
        >
          <p className="text-sm font-medium text-text-primary">{reasonCopy.title}</p>
          <p className="mt-1 text-sm text-text-secondary">{reasonCopy.body}</p>
        </div>
      ) : null}

      {params.error ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {params.error}
        </p>
      ) : null}

      <ActionForm
        action={signInAction}
        className="mt-8 space-y-4"
        pendingLabel="Signing in…"
      >
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
      </ActionForm>

      <p className="mt-8 border-t border-border pt-5 text-sm text-text-muted">
        Having trouble signing in?{" "}
        <Link
          href="/recovery"
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          Open recovery options
        </Link>
      </p>
    </main>
  );
}
