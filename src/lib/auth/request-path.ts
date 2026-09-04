import { headers } from "next/headers";
import {
  HOUSEHOLDOS_PATH_HEADER,
  safeLoginReturnPath,
} from "@/lib/auth/login-next";

/** Current request path from proxy, sanitized for login `next=`. */
export async function currentRequestPath(fallback = "/app"): Promise<string> {
  try {
    const headerStore = await headers();
    return safeLoginReturnPath(
      headerStore.get(HOUSEHOLDOS_PATH_HEADER),
      fallback,
    );
  } catch {
    return fallback;
  }
}
