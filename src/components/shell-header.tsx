import Link from "next/link";
import { signOutAction } from "@/app/actions/auth";

export function ShellHeader({
  title,
  householdName,
}: {
  title?: string;
  householdName?: string;
}) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-[#f7f3ea]/90 px-4 py-3 backdrop-blur">
      <div>
        <Link href="/app" className="font-[family-name:var(--font-display)] text-lg">
          HouseholdOS
        </Link>
        {householdName ? (
          <p className="text-xs text-slate-600">{householdName}</p>
        ) : null}
        {title ? <p className="sr-only">{title}</p> : null}
      </div>
      <form action={signOutAction}>
        <button type="submit" className="text-sm text-slate-600 underline">
          Sign out
        </button>
      </form>
    </header>
  );
}
