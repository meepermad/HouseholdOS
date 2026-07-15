import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  CURRENT_HOUSEHOLD_COOKIE,
  isHouseholdId,
  validateCurrentHouseholdSelection,
} from "@/lib/navigation";
import type { HouseholdResponsibility } from "@/types/database";
import { AppError } from "@/lib/errors";

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

export async function assertActiveMembership(
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

  const roles = await getMembershipRoles(membership.id);
  await persistCurrentHousehold(householdId);

  return {
    userId: user.id,
    householdId,
    roles,
    membershipId: membership.id,
  };
}

export async function persistCurrentHousehold(householdId: string) {
  const cookieStore = await cookies();
  cookieStore.set(CURRENT_HOUSEHOLD_COOKIE, householdId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  const supabase = await createClient();
  await supabase.rpc("set_current_household", { p_household_id: householdId });
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
    // Stale cookie with no memberships — clear so /app ↔ cookie loops stop.
    try {
      await clearCurrentHouseholdCookie();
    } catch {
      // Cookie store may be read-only in some contexts.
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

  // Invalid / unauthorized cookie preference — clear without throwing.
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

  // Persist a valid preference when cookie/prefs were stale.
  if (authorized[0]) {
    try {
      await persistCurrentHousehold(authorized[0]);
    } catch {
      // Prefer returning an id even if preference write fails.
    }
  }

  return authorized[0] ?? null;
}
