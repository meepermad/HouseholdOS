"use server";

import { requireUser } from "@/lib/household-context";
import { isThemeMode, type ThemeMode } from "@/lib/theme/types";
import { logServerError } from "@/lib/errors";

export async function persistThemePreferenceAction(mode: ThemeMode) {
  if (!isThemeMode(mode)) return;

  try {
    const { supabase, user } = await requireUser();
    if (!user) return;

    const { data: existing, error: readError } = await supabase
      .from("user_preferences")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (readError) {
      logServerError("persist_theme_preference_read", readError, {
        userId: user.id,
      });
      return;
    }

    if (existing) {
      const { error } = await supabase
        .from("user_preferences")
        .update({ theme: mode })
        .eq("user_id", user.id);
      if (error) {
        logServerError("persist_theme_preference_update", error, {
          userId: user.id,
        });
      }
      return;
    }

    const { error } = await supabase.from("user_preferences").insert({
      user_id: user.id,
      theme: mode,
    });
    if (error) {
      logServerError("persist_theme_preference_insert", error, {
        userId: user.id,
      });
    }
  } catch (error) {
    logServerError("persist_theme_preference", error);
  }
}
