import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  CURRENT_HOUSEHOLD_COOKIE,
  isHouseholdId,
  validateCurrentHouseholdSelection,
} from "@/lib/navigation";
import type { HouseholdResponsibility } from "@/types/database";
import { AppError, logServerError } from "@/lib/errors";

export type HouseholdContext = {
  userId: string;
  householdId: string;
  roles: HouseholdResponsibility[];
  membershipId: string;
};

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { supabase, user: null as null };
  }
  return { supabase, user };
}

export async function ensureProfileOrRecover() {
  const { supabase, user } = await requireUser();
  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase.rpc("ensure_profile");
  if (error || !data) {
    throw new AppError(
      "database_failure",
      "Your profile could not be initialized. Try refreshing, or sign out and back in.",
    );
  }
  return { supabase, user, profile: data };
}

export async function listAuthorizedHouseholdIds(userId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("household_memberships")
    .select("household_id")
    .eq("user_id", userId)
    .eq("status", "active");
  return (data ?? []).map((row) => row.household_id);
}

export async function getMembershipRoles(
  membershipId: string,
): Promise<HouseholdResponsibility[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("household_membership_roles")
    .select("role")
    .eq("membership_id", membershipId);
  return (data ?? []).map((r) => r.role as HouseholdResponsibility);
}

/**
 * Verify active membership for a household URL.
 * Must not mutate cookies — layouts call this during RSC render, and Next.js
 * only allows cookie writes from Server Actions / Route Handlers.
 * Cached per request so layout + page do not double-write preferences.
 */
export const assertActiveMembership = cache(
  async function assertActiveMembership(
    householdId: string,
  ): Promise<HouseholdContext> {
    if (!isHouseholdId(householdId)) {
      throw new AppError("not_found", "Household not found.");
    }

    const { supabase, user } = await requireUser();
    if (!user) {
      redirect(`/login?next=${encodeURIComponent(`/app/${householdId}`)}`);
    }

    const { data: membership, error } = await supabase
      .from("household_memberships")
      .select("id, household_id, user_id, status")
      .eq("household_id", householdId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (error) {
      throw new AppError(
        "database_failure",
        "Unable to verify household membership right now.",
      );
    }

    if (!membership) {
      throw new AppError(
        "authorization",
        "You do not have access to this household.",
      );
    }

    // Roles + preference sync are independent after membership is known.
    const [roles] = await Promise.all([
      getMembershipRoles(membership.id),
      syncCurrentHouseholdPreference(householdId, user.id).catch(() => {
        // Preference write must not block authorized dashboard access.
      }),
    ]);

    return {
      userId: user.id,
      householdId,
      roles,
      membershipId: membership.id,
    };
  },
);

/** DB preference only — safe from Server Components. Skips no-op writes. */
export async function syncCurrentHouseholdPreference(
  householdId: string,
  userId?: string,
) {
  const supabase = await createClient();
  if (userId) {
    const { data: prefs } = await supabase
      .from("user_preferences")
      .select("current_household_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (prefs?.current_household_id === householdId) {
      return;
    }
  }
  const { error } = await supabase.rpc("set_current_household", {
    p_household_id: householdId,
  });
  if (error) {
    throw new AppError(
      "database_failure",
      "The household could not be selected automatically.",
    );
  }
}

/** Cookie only — Server Actions / Route Handlers. */
export async function setCurrentHouseholdCookie(householdId: string) {
  const cookieStore = await cookies();
  cookieStore.set(CURRENT_HOUSEHOLD_COOKIE, householdId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

/**
 * Preference + cookie. Call only from Server Actions / Route Handlers.
 * Cookie failure is logged and returned; preference failure throws.
 */
export async function persistCurrentHousehold(householdId: string): Promise<{
  cookieSet: boolean;
}> {
  await syncCurrentHouseholdPreference(householdId);

  try {
    await setCurrentHouseholdCookie(householdId);
    return { cookieSet: true };
  } catch (error) {
    logServerError("persist_current_household_cookie", error, { householdId });
    return { cookieSet: false };
  }
}

export async function clearCurrentHouseholdCookie() {
  const cookieStore = await cookies();
  cookieStore.set(CURRENT_HOUSEHOLD_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function resolvePreferredHouseholdId(
  userId: string,
): Promise<string | null> {
  const authorized = await listAuthorizedHouseholdIds(userId);
  if (authorized.length === 0) {
    try {
      await clearCurrentHouseholdCookie();
    } catch {
      // Cookie store may be read-only in RSC.
    }
    return null;
  }

  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(CURRENT_HOUSEHOLD_COOKIE)?.value;

  const cookieValid = validateCurrentHouseholdSelection({
    requestedId: fromCookie,
    authorizedHouseholdIds: authorized,
  });
  if (cookieValid) return cookieValid;

  if (fromCookie) {
    try {
      await clearCurrentHouseholdCookie();
    } catch {
      // ignore
    }
  }

  const supabase = await createClient();
  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("current_household_id")
    .eq("user_id", userId)
    .maybeSingle();

  const fromPrefs = validateCurrentHouseholdSelection({
    requestedId: prefs?.current_household_id,
    authorizedHouseholdIds: authorized,
  });
  if (fromPrefs) return fromPrefs;

  // No cookie/preference — leave selection null so /app can show the selector.
  return null;
}
