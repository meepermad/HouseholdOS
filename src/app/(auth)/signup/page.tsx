import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { signUpAction } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env/server";
import { resolveInviteToken } from "@/lib/invitations/resolve-token";
import { safeRedirectPath } from "@/lib/navigation";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; invite?: string; reason?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect(safeRedirectPath(params.next, "/onboarding"));
  }

  const env = getServerEnv();
  const next = safeRedirectPath(params.next, "/onboarding");
  const inviteToken = resolveInviteToken({
    invite: params.invite,
    next,
  });

  return (
    <main className="safe-pt safe-pb mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <p className="font-[family-name:var(--font-display)] text-2xl tracking-tight">
        HouseholdOS
      </p>
      <h1 className="mt-6 text-xl font-semibold">Create account</h1>
      <p className="mt-2 text-sm text-slate-600">
        {inviteToken
          ? "Your invitation was recognized. Use the invited email address to create your account."
          : "HouseholdOS is invite-only. Open your invitation link, or paste it below after creating an account is blocked."}{" "}
        Already registered?{" "}
        <Link
          href={`/login?next=${encodeURIComponent(next)}${
            inviteToken ? `&invite=${encodeURIComponent(inviteToken)}` : ""
          }`}
          className="underline"
        >
          Sign in
        </Link>
      </p>
      {!inviteToken ? (
        <p className="mt-4 text-sm text-amber-800" role="status">
          No invitation token in this page URL. Prefer opening{" "}
          <Link href="/join/paste" className="underline">
            your join link
          </Link>{" "}
          first. If a coordinator already invited this email, registration can still
          proceed when you use that exact email.
        </p>
      ) : null}
      <ActionForm action={signUpAction} className="mt-8 space-y-4" pendingLabel="Creating account…">
        <input type="hidden" name="next" value={next} />
        {inviteToken ? (
          <input type="hidden" name="inviteToken" value={inviteToken} />
        ) : null}
        <label className="block text-sm">
          Display name
          <input
            name="displayName"
            type="text"
            autoComplete="nickname"
            className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white"
        >
          Create account
        </button>
      </ActionForm>
      <p className="mt-2 text-xs text-text-muted">
        Registration mode: <span className="font-medium">{env.REGISTRATION_MODE}</span>
      </p>
    </main>
  );
}
