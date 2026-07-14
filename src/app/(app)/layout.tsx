import Link from "next/link";
import { redirect } from "next/navigation";
import { signOutAction } from "@/app/actions/household";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-[#f7f3ea]/90 px-4 py-3 backdrop-blur">
        <Link href="/households" className="font-[family-name:var(--font-display)] text-lg">
          HouseholdOS
        </Link>
        <form action={signOutAction}>
          <button type="submit" className="text-sm text-slate-600 underline">
            Sign out
          </button>
        </form>
      </header>
      <div className="flex-1 px-4 py-6">{children}</div>
    </div>
  );
}
