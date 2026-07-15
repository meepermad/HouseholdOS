import "server-only";

import { createClient } from "@/lib/supabase/server";
import { isThemeMode, type ThemeMode } from "@/lib/theme/types";

/** Load theme from user_preferences when a session exists; otherwise null. */
export async function getAuthenticatedThemePreference(): Promise<ThemeMode | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("user_preferences")
      .select("theme")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !data) return null;
    const theme = (data as { theme?: string }).theme;
    return isThemeMode(theme) ? theme : null;
  } catch {
    return null;
  }
}
