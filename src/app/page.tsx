import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-end px-5 pb-10 pt-16 sm:justify-center">
      <p className="font-[family-name:var(--font-display)] text-5xl leading-none tracking-tight text-slate-900">
        HouseholdOS
      </p>
      <p className="mt-4 max-w-sm text-base leading-relaxed text-slate-700">
        Shared money, ownership, chores, and commitments — with an audit trail you can trust.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/signup"
          className="rounded-md bg-accent px-5 py-3 text-center text-sm font-semibold text-white"
        >
          Create account
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-line bg-surface px-5 py-3 text-center text-sm font-semibold"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
