import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { acceptInviteAction } from "@/app/actions/household";
import { createClient } from "@/lib/supabase/server";
import { hashInviteToken } from "@/lib/tokens";
import { formatInTimezone } from "@/lib/time";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: previewRows } = await supabase.rpc("get_invitation_preview", {
    p_token_hash: hashInviteToken(token),
  });
  const preview = Array.isArray(previewRows) ? previewRows[0] : previewRows;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Household invite</h1>
      {!preview ? (
        <p className="mt-4 text-sm text-slate-600">This invitation link is invalid.</p>
      ) : (
        <div className="mt-4 space-y-2 text-sm text-slate-700">
          <p>
            Join <strong>{preview.household_name}</strong> as <strong>{preview.role}</strong>.
          </p>
          <p>Invited email: {preview.email}</p>
          <p>Status: {preview.status}</p>
          <p>Expires: {formatInTimezone(preview.expires_at)}</p>
        </div>
      )}

      {!user ? (
        <p className="mt-6 text-sm">
          <Link href="/login" className="underline">
            Sign in
          </Link>{" "}
          with the invited email to accept.
        </p>
      ) : preview && preview.status === "pending" ? (
        <ActionForm action={acceptInviteAction} className="mt-6">
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="w-full rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white"
          >
            Accept invitation
          </button>
        </ActionForm>
      ) : null}
    </main>
  );
}
