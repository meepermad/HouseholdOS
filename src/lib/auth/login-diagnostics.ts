import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  listAuthorizedHouseholdIds,
  resolvePreferredHouseholdId,
} from "@/lib/household-context";
import { CURRENT_HOUSEHOLD_COOKIE } from "@/lib/navigation";

export type LoginDiagnostics = {
  authCookieDetected: boolean;
  serverSessionValid: boolean;
  profileInitialized: boolean | null;
  activeHouseholdCount: number | null;
  selectedHouseholdValid: boolean | null;
  clientBundleHint: string;
};

/** Non-secret diagnostics for recovery UI. Never includes tokens or emails. */
export async function loadLoginDiagnostics(): Promise<LoginDiagnostics> {
  const cookieStore = await cookies();
  const authCookieDetected = cookieStore
    .getAll()
    .some((c) => c.name.includes("auth-token") || c.name.startsWith("sb-"));

  const bundleHint =
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
    process.env.NEXT_PUBLIC_BUILD_ID?.slice(0, 7) ??
    "local";

  const base: LoginDiagnostics = {
    authCookieDetected,
    serverSessionValid: false,
    profileInitialized: null,
    activeHouseholdCount: null,
    selectedHouseholdValid: null,
    clientBundleHint: bundleHint,
  };

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return base;

    base.serverSessionValid = true;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    base.profileInitialized = Boolean(profile);

    const authorized = await listAuthorizedHouseholdIds(user.id);
    base.activeHouseholdCount = authorized.length;
    const preferred = await resolvePreferredHouseholdId(user.id);
    const cookieHousehold = cookieStore.get(CURRENT_HOUSEHOLD_COOKIE)?.value;
    base.selectedHouseholdValid = Boolean(
      preferred &&
        authorized.includes(preferred) &&
        (!cookieHousehold || cookieHousehold === preferred || authorized.includes(cookieHousehold)),
    );
    return base;
  } catch {
    return base;
  }
}
