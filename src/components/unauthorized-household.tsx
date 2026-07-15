import Link from "next/link";
import {
  RecoveryClearHouseholdForm,
  RecoveryLogoutForm,
} from "@/components/recovery-actions";

/** Safe unauthorized / stale-household escape UI (no shell dependency). */
export function UnauthorizedHouseholdState({
  message,
}: {
  message: string;
}) {
  return (
    <main
      className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5"
      data-testid="unauthorized-household"
    >
      <h1 className="text-xl font-semibold">Household unavailable</h1>
      <p className="mt-2 text-sm text-slate-600">{message}</p>
      <p className="mt-2 text-sm text-slate-600">
        This can happen if your membership changed or the household link is stale.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/app"
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"
        >
          Return to household selection
        </Link>
        <Link href="/recovery" className="rounded-md border border-line px-3 py-2 text-sm">
          Recovery
        </Link>
      </div>
      <div className="mt-4">
        <RecoveryClearHouseholdForm next="/app" />
        <RecoveryLogoutForm />
      </div>
    </main>
  );
}
