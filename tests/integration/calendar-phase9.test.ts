/**
 * Phase 9 calendar RLS smoke (linked DB).
 * Skips when Supabase env is unavailable.
 */
import { describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasSupabase = Boolean(url && secretKey);

describe.skipIf(!hasSupabase)("phase9 calendar schema presence", () => {
  it("exposes new calendar tables via privileged client", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(url!, secretKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const tables = [
      "household_calendars",
      "calendar_availability_rules",
      "calendar_resources",
      "calendar_external_connections",
      "calendar_sync_runs",
    ];
    for (const table of tables) {
      const { error } = await admin.from(table).select("id").limit(1);
      expect(error, table).toBeNull();
    }
  });
});
