import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { consumeCreateHouseholdRegistrationAction } from "@/app/actions/registration-invitations";
import { requireUser } from "@/lib/household-context";
import { createClient } from "@/lib/supabase/server";
import { hashInviteToken } from "@/lib/tokens";

type PreviewStatus = "pending" | "expired" | "revoked" | "consumed" | "invalid";

function SafeState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
      <p className="font-[family-name:var(--font-display)] text-2xl">HouseholdOS</p>
      <h1 className="mt-6 text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">{body}</p>
      <Link href="/login" className="mt-4 underline">
        Sign in
      </Link>
    </main>
  );
}

export default async function CreateHouseholdRegisterPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_registration_invitation_preview", {
    p_token_hash: hashInviteToken(token),
  });
  const preview = Array.isArray(data) ? data[0] : data;
  const { user } = await requireUser();

  if (!preview) {
    return (
      <SafeState
        title="Invitation not available"
        body="This link is invalid or no longer available."
      />
    );
  }

  const status = preview.status as PreviewStatus;

  if (status === "expired") {
    return (
      <SafeState
        title="Invitation expired"
        body="Ask the person who invited you to send a new independent-household registration invitation."
      />
    );
  }

  if (status === "revoked") {
    return (
      <SafeState
        title="Invitation revoked"
        body="This registration invitation is no longer valid."
      />
    );
  }

  if (status === "consumed") {
    return (
      <SafeState
        title="Invitation already used"
        body="This invitation has already been used. Sign in to continue to your household."
      />
    );
  }

  if (status !== "pending" || preview.purpose !== "create_household") {
    return (
      <SafeState
        title="Invitation not available"
        body="This link is invalid or no longer available."
      />
    );
  }

  const registerNext = `/register/create-household/${token}`;

  if (!user) {
    redirect(
      `/signup?invite=${encodeURIComponent(token)}&next=${encodeURIComponent(registerNext)}`,
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <p className="font-[family-name:var(--font-display)] text-2xl">HouseholdOS</p>
      <h1 className="mt-6 text-xl font-semibold">Create your own household</h1>
      <p className="mt-2 text-sm text-slate-600">
        This invitation lets you register and create an <strong>independent</strong>{" "}
        household. It does not add you to someone else&apos;s household.
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Invite domain: @{preview.invited_email_domain} · expires{" "}
        {new Date(preview.expires_at).toLocaleString()}
      </p>
      <p className="mt-4 text-sm text-slate-600">
        Continue as <strong>{user.email}</strong>. You must use the exact invited email
        address.
      </p>
      <div className="mt-8">
        <ActionForm
          action={consumeCreateHouseholdRegistrationAction}
          pendingLabel="Continuing…"
        >
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white"
          >
            Continue to create household
          </button>
        </ActionForm>
      </div>
      <p className="mt-4 text-xs text-slate-500">
        Wrong account?{" "}
        <Link href={`/login?next=${encodeURIComponent(registerNext)}`} className="underline">
          Sign in with the invited email
        </Link>
        .
      </p>
    </main>
  );
}
