import { redirect } from "next/navigation";
import { signOutAction } from "@/app/actions/auth";
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
          <form action={signOutAction} className="mt-6">
            <button type="submit" className="underline">
              Sign out and try again
            </button>
          </form>
        </main>
      );
    }
    redirect("/login");
  }

  return <>{children}</>;
}
