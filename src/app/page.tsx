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
    <main className="relative min-h-dvh overflow-x-hidden bg-background text-text-primary">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,color-mix(in_oklab,var(--accent-soft)_85%,transparent),transparent_46%),radial-gradient(circle_at_82%_0%,color-mix(in_oklab,var(--surface-secondary)_90%,transparent),transparent_42%),linear-gradient(165deg,var(--background),color-mix(in_oklab,var(--accent-soft)_35%,var(--background)))]"
      />
      <div className="safe-pt safe-pb relative mx-auto flex min-h-dvh max-w-lg flex-col justify-end px-6 pb-10 pt-16">
        <p className="font-[family-name:var(--font-display)] text-5xl leading-none tracking-tight text-ink">
          HouseholdOS
        </p>
        <h1 className="mt-6 max-w-[16ch] text-2xl font-medium leading-snug text-text-primary">
          Shared house admin without the spreadsheet sprawl.
        </h1>
        <p className="mt-3 max-w-[34ch] text-sm leading-relaxed text-text-secondary">
          Private login for roommates. Track shared money now; chores and house
          records come next.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 py-3 text-center text-sm font-semibold text-primary-foreground"
          >
            Create account
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface/80 px-5 py-3 text-center text-sm font-semibold text-text-primary"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
