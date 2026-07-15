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
      secondary={<RecoveryClearHouseholdForm next="/app" />}
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
