import Link from "next/link";
import {
  RecoveryClearHouseholdForm,
  RecoveryLogoutForm,
} from "@/components/recovery-actions";
import { RecoveryScreen, recoveryControlClass } from "@/components/recovery-screen";

/** Safe unauthorized / stale-household escape UI (no shell dependency). */
export function UnauthorizedHouseholdState({
  message,
}: {
  message: string;
}) {
  return (
    <RecoveryScreen
      testId="unauthorized-household"
      title="Household unavailable"
      body={`${message} This can happen if your membership changed or the household link is outdated.`}
      primary={
        <>
          <Link href="/app" className={recoveryControlClass.primary}>
            Choose a household
          </Link>
          <RecoveryLogoutForm variant="secondary" />
        </>
      }
      secondary={<RecoveryClearHouseholdForm next="/app" />}
      footer={
        <>
          Still stuck?{" "}
          <Link href="/recovery" className={recoveryControlClass.link}>
            Recovery options
          </Link>
        </>
      }
    />
  );
}
