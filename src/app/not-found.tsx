import Link from "next/link";
import {
  RecoveryClearHouseholdForm,
  RecoveryLogoutForm,
} from "@/components/recovery-actions";
import { RecoveryScreen, recoveryControlClass } from "@/components/recovery-screen";

export default function NotFound() {
  return (
    <RecoveryScreen
      testId="not-found"
      title="Not found"
      body="That page or household does not exist, or you do not have access."
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
