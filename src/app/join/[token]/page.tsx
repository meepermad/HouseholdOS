import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { acceptInviteAction, declineInviteAction } from "@/app/actions/household";
import { createClient } from "@/lib/supabase/server";
import { hashInviteToken } from "@/lib/tokens";
import { requireUser } from "@/lib/household-context";

export default async function JoinInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_invitation_preview", {
    p_token_hash: hashInviteToken(token),
  });
  const preview = Array.isArray(data) ? data[0] : data;

  const { user } = await requireUser();

  if (!preview) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
        <h1 className="text-xl font-semibold">Invitation not found</h1>
        <p className="mt-2 text-sm text-slate-600">
          This link is invalid or no longer available.
        </p>
        <Link href="/login" className="mt-4 underline">
          Sign in
        </Link>
      </main>
    );
  }

  if (preview.status === "expired") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
        <h1 className="text-xl font-semibold">Invitation expired</h1>
        <p className="mt-2 text-sm text-slate-600">
          Ask a household coordinator to send a new invite.
        </p>
      </main>
    );
  }

  if (preview.status === "revoked") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
        <h1 className="text-xl font-semibold">Invitation revoked</h1>
        <p className="mt-2 text-sm text-slate-600">
          This invite is no longer valid.
        </p>
      </main>
    );
  }

  if (!user) {
    redirect(
      `/signup?invite=${encodeURIComponent(token)}&next=${encodeURIComponent(`/join/${token}`)}`,
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <p className="font-[family-name:var(--font-display)] text-2xl">HouseholdOS</p>
      <h1 className="mt-6 text-xl font-semibold">Join household</h1>
      <p className="mt-2 text-sm text-slate-600">
        You are invited to <strong>{preview.household_name}</strong>
        {preview.property_nickname ? ` (${preview.property_nickname})` : ""}.
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Invite domain: @{preview.invited_email_domain} · expires{" "}
        {new Date(preview.expires_at).toLocaleString()}
      </p>
      <div className="mt-8 flex gap-3">
        <ActionForm action={acceptInviteAction} pendingLabel="Joining household…">
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white"
          >
            Accept
          </button>
        </ActionForm>
        <ActionForm action={declineInviteAction} pendingLabel="Declining invitation…">
          <input type="hidden" name="token" value={token} />
          <button type="submit" className="rounded-md border border-line px-4 py-3 text-sm">
            Decline
          </button>
        </ActionForm>
      </div>
    </main>
  );
}
