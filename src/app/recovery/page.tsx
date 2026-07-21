/* eslint-disable @next/next/no-html-link-for-pages -- recovery stays usable without the app shell */
import {
  RecoveryClearHouseholdForm,
  RecoveryLogoutForm,
} from "@/components/recovery-actions";
import { RecoveryScreen, recoveryControlClass } from "@/components/recovery-screen";
import {
  classifyRecoveryReason,
  formatErrorReference,
  recoveryCopy,
} from "@/lib/recovery";
import { loadLoginDiagnostics } from "@/lib/auth/login-diagnostics";

export const dynamic = "force-dynamic";

export default async function RecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; ref?: string }>;
}) {
  const params = await searchParams;
  const state = classifyRecoveryReason(params.reason);
  const copy = recoveryCopy(state);
  const reference = formatErrorReference(params.ref);
  const diagnostics = await loadLoginDiagnostics();

  return (
    <RecoveryScreen
      title={copy.title}
      body={copy.body}
      reference={reference}
      testId="recovery-page"
      primary={
        <>
          <a href="/app" className={recoveryControlClass.primary}>
            Return to HouseholdOS
          </a>
          <RecoveryLogoutForm variant="secondary" />
        </>
      }
      secondary={
        <>
          <RecoveryClearHouseholdForm next="/app" />
          <div
            className="w-full rounded-md border border-border bg-surface px-3 py-3 text-left text-xs text-text-secondary"
            data-testid="login-diagnostics"
          >
            <p className="font-semibold text-text-primary">Login diagnostics</p>
            <ul className="mt-2 space-y-1">
              <li>
                Authentication cookie detected:{" "}
                {diagnostics.authCookieDetected ? "yes" : "no"}
              </li>
              <li>
                Server session valid:{" "}
                {diagnostics.serverSessionValid ? "yes" : "no"}
              </li>
              <li>
                Profile initialized:{" "}
                {diagnostics.profileInitialized === null
                  ? "n/a"
                  : diagnostics.profileInitialized
                    ? "yes"
                    : "no"}
              </li>
              <li>
                Active households found:{" "}
                {diagnostics.activeHouseholdCount === null
                  ? "n/a"
                  : String(diagnostics.activeHouseholdCount)}
              </li>
              <li>
                Selected household valid:{" "}
                {diagnostics.selectedHouseholdValid === null
                  ? "n/a"
                  : diagnostics.selectedHouseholdValid
                    ? "yes"
                    : "no"}
              </li>
              <li>Client bundle version: {diagnostics.clientBundleHint}</li>
            </ul>
          </div>
        </>
      }
      footer={
        <>
          Need a different account?{" "}
          <a href="/login" className={recoveryControlClass.link}>
            Sign in
          </a>
        </>
      }
    />
  );
}
