import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  APP_CONTEXT_COOKIE_NAMES,
  householdCookieClearOptions,
} from "@/lib/recovery";
import { logRecoveryEvent } from "@/lib/recovery-log";

/** Clear HouseholdOS context cookies using the same attributes used when setting them. */
export async function clearHouseholdOsContextCookies(): Promise<void> {
  const cookieStore = await cookies();
  const options = householdCookieClearOptions();
  for (const name of APP_CONTEXT_COOKIE_NAMES) {
    cookieStore.set(name, "", options);
  }
}

/**
 * Sign out via cookie-aware SSR client and clear app context cookies.
 * Idempotent: missing/invalid sessions are treated as success.
 */
export async function performEmergencyLogout(route = "/auth/logout"): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      logRecoveryEvent("emergency_logout", error, {
        category: "session",
        route,
      });
    }
  } catch (error) {
    logRecoveryEvent("emergency_logout", error, {
      category: "session",
      route,
    });
  }

  try {
    await clearHouseholdOsContextCookies();
  } catch (error) {
    logRecoveryEvent("emergency_logout_cookies", error, {
      category: "cookie",
      route,
    });
  }
}

/**
 * Clear household selection cookie and best-effort reset of user_preferences.
 * Does not require the selected household to be valid.
 */
export async function performClearHouseholdContext(
  route = "/auth/clear-household",
): Promise<{ redirectedTo: "/app" | "/onboarding" }> {
  await clearHouseholdOsContextCookies();

  let hasMemberships = false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { error: prefError } = await supabase
        .from("user_preferences")
        .update({ current_household_id: null })
        .eq("user_id", user.id);
      if (prefError) {
        logRecoveryEvent("clear_household_prefs", prefError, {
          category: "preference",
          route,
          userId: user.id,
        });
      }

      const { data: memberships } = await supabase
        .from("household_memberships")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1);
      hasMemberships = (memberships ?? []).length > 0;
    }
  } catch (error) {
    logRecoveryEvent("clear_household_context", error, {
      category: "preference",
      route,
    });
  }

  return { redirectedTo: hasMemberships ? "/app" : "/onboarding" };
}
