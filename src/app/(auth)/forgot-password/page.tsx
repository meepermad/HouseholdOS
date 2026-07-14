import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { forgotPasswordAction } from "@/app/actions/auth";

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <p className="font-[family-name:var(--font-display)] text-2xl tracking-tight">
        HouseholdOS
      </p>
      <h1 className="mt-6 text-xl font-semibold">Forgot password</h1>
      <p className="mt-2 text-sm text-slate-600">
        We will email a reset link if an account exists for that address.
      </p>
      <ActionForm action={forgotPasswordAction} className="mt-8 space-y-4">
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
        <button
          type="submit"
          className="w-full rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white"
        >
          Send reset link
        </button>
      </ActionForm>
      <p className="mt-6 text-sm">
        <Link href="/login" className="underline">
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
