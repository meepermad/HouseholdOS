import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { signInAction } from "@/app/actions/household";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Sign in</h1>
      <p className="mt-2 text-sm text-slate-600">
        No account?{" "}
        <Link href="/signup" className="underline">
          Create one
        </Link>
      </p>
      <ActionForm action={signInAction} className="mt-8 space-y-4">
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
            autoComplete="current-password"
            className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white"
        >
          Sign in
        </button>
      </ActionForm>
    </main>
  );
}
