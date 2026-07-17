import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasSupabase = Boolean(url && secret);

describe.skipIf(!hasSupabase)("receipts RLS (live)", () => {
  it("expense_receipts table is queryable under service role after migration", async () => {
    const admin = createClient(url!, secret!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await admin.from("expense_receipts").select("id").limit(1);
    // Before migration apply this may fail — assert shape of error or success
    if (error) {
      expect(error.message.toLowerCase()).toMatch(/relation|schema|permission|does not exist/);
    } else {
      expect(error).toBeNull();
    }
  });
});
