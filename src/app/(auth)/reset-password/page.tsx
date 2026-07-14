import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { resetPasswordAction } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/server";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?error=" + encodeURIComponent("Open the reset link from your email first."));
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <p className="font-[family-name:var(--font-display)] text-2xl tracking-tight">
        HouseholdOS
      </p>
      <h1 className="mt-6 text-xl font-semibold">Choose a new password</h1>
      <ActionForm action={resetPasswordAction} className="mt-8 space-y-4">
        <label className="block text-sm">
          New password
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Confirm password
          <input
            name="confirmPassword"
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
          Update password
        </button>
      </ActionForm>
    </main>
  );
}
