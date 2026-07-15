import Link from "next/link";
import { redirect } from "next/navigation";
import {
  RecoveryClearHouseholdForm,
  RecoveryLogoutForm,
} from "@/components/recovery-actions";
import { ensureProfileOrRecover } from "@/lib/household-context";
import { AppError } from "@/lib/errors";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await ensureProfileOrRecover();
  } catch (error) {
    if (error instanceof AppError && error.code === "database_failure") {
      return (
        <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
          <h1 className="text-xl font-semibold">Profile recovery needed</h1>
          <p className="mt-2 text-sm text-slate-600">{error.publicMessage}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/recovery" className="rounded-md border border-line px-3 py-2 text-sm">
              Recovery
            </Link>
          </div>
          <div className="mt-4">
            <RecoveryClearHouseholdForm next="/onboarding" />
            <RecoveryLogoutForm label="Sign out and try again" />
          </div>
        </main>
      );
    }
    redirect("/login?reason=session_expired");
  }

  return <>{children}</>;
}
