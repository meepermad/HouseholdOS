import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect("/app");
  }

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,#dce8df,transparent_45%),radial-gradient(circle_at_80%_0%,#efe3d2,transparent_40%),linear-gradient(160deg,#f7f3ea,#e8efe9)]" />
      <div className="relative mx-auto flex min-h-dvh max-w-lg flex-col justify-end px-6 pb-16 pt-20">
        <p className="font-[family-name:var(--font-display)] text-5xl leading-none tracking-tight text-ink">
          HouseholdOS
        </p>
        <h1 className="mt-6 max-w-[16ch] text-2xl font-medium leading-snug text-ink">
          Shared house admin without the spreadsheet sprawl.
        </h1>
        <p className="mt-3 max-w-[34ch] text-sm leading-relaxed text-slate-700">
          Private login for roommates. Start with membership, then money and chores later.
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
            className="rounded-md border border-line bg-surface/80 px-5 py-3 text-center text-sm font-semibold"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
