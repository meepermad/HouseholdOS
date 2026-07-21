import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { createClient } from "@/lib/supabase/server";
import { resolveInviteToken } from "@/lib/invitations/resolve-token";
import { safeRedirectPath } from "@/lib/navigation";
import {
  classifyRecoveryReason,
  recoveryCopy,
  safeRecoveryDestination,
} from "@/lib/recovery";
import { getPublicBuildInfo } from "@/lib/build-info";
import {
  mapSignInErrorMessage,
  type SignInErrorCode,
} from "@/lib/auth/sign-in-request";

const SIGN_IN_ERROR_CODES = new Set<string>([
  "invalid_credentials",
  "validation",
  "rate_limit",
  "origin",
  "profile",
  "unsupported",
  "server",
]);

function loginErrorMessage(code: string | undefined): string | null {
  if (!code || !SIGN_IN_ERROR_CODES.has(code)) return null;
  return mapSignInErrorMessage(code as SignInErrorCode);
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string;
    error?: string;
    reason?: string;
    invite?: string;
  }>;
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
  const inviteToken = resolveInviteToken({
    invite: params.invite,
    next,
  });
  const signupHref = inviteToken
    ? `/signup?invite=${encodeURIComponent(inviteToken)}&next=${encodeURIComponent(next)}`
    : `/signup?next=${encodeURIComponent(next)}`;
  const reasonState = classifyRecoveryReason(params.reason);
  const reasonCopy =
    params.reason && reasonState !== "unexpected"
      ? recoveryCopy(reasonState)
      : null;
  const build = getPublicBuildInfo();
  const formError = loginErrorMessage(params.error);

  return (
    <main className="safe-pt safe-pb mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <p className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-text-primary">
        HouseholdOS
      </p>
      <h1 className="mt-6 text-xl font-semibold text-text-primary">Sign in</h1>
      <p className="mt-2 text-sm text-text-secondary">
        No account?{" "}
        <Link
          href={signupHref}
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          Create account
        </Link>
      </p>

      {reasonCopy ? (
        <div
          className="mt-6 rounded-md border border-border bg-surface px-4 py-3"
          role="status"
          data-testid="login-security-notice"
        >
          <p className="text-sm font-medium text-text-primary">{reasonCopy.title}</p>
          <p className="mt-1 text-sm text-text-secondary">{reasonCopy.body}</p>
        </div>
      ) : null}

      {formError ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {formError}
        </p>
      ) : null}

      <LoginForm next={next} />

      <p className="mt-8 border-t border-border pt-5 text-sm text-text-muted">
        Having trouble signing in?{" "}
        <Link
          href="/recovery"
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          Open recovery options
        </Link>
      </p>
      <p
        className="mt-3 text-[0.65rem] text-text-muted"
        data-testid="login-build-version"
      >
        Build {build.commitSha}
        {build.deploymentId !== "local" ? ` · ${build.deploymentId}` : ""}
      </p>
    </main>
  );
}
