import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { signInAction } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/navigation";
import { classifyRecoveryReason, recoveryCopy, safeRecoveryDestination } from "@/lib/recovery";

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

  // Authenticated users skip login unless they just signed out (stale cookie race).
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
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <p className="font-[family-name:var(--font-display)] text-2xl tracking-tight">
        HouseholdOS
      </p>
      <h1 className="mt-6 text-xl font-semibold">Sign in</h1>
      <p className="mt-2 text-sm text-slate-600">
        No account?{" "}
        <Link href={`/signup?next=${encodeURIComponent(next)}`} className="underline">
          Request access
        </Link>
      </p>
      {params.error ? (
        <p className="mt-4 text-sm text-red-700" role="alert">
          {params.error}
        </p>
      ) : null}
      {reasonCopy ? (
        <p className="mt-4 text-sm text-slate-700" role="status">
          {reasonCopy.body}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-slate-500">
        Stuck?{" "}
        <Link href="/recovery" className="underline">
          Open recovery options
        </Link>
      </p>
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
          <Link href="/forgot-password" className="underline">
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
    </main>
  );
}
