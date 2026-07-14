import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const hasSupabase = Boolean(url && serviceKey && anonKey);

describe.skipIf(!hasSupabase)("RLS household isolation", () => {
  it("prevents cross-household reads with anon-authenticated users", async () => {
    const admin = createClient(url!, serviceKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const emailA = `a-${Date.now()}@example.com`;
    const emailB = `b-${Date.now()}@example.com`;
    const password = "test-password-123";

    const userA = await admin.auth.admin.createUser({
      email: emailA,
      password,
      email_confirm: true,
    });
    const userB = await admin.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
    });
    expect(userA.data.user).toBeTruthy();
    expect(userB.data.user).toBeTruthy();

    const clientA = createClient(url!, anonKey!);
    await clientA.auth.signInWithPassword({ email: emailA, password });
    const created = await clientA.rpc("create_household", {
      p_name: "House A",
      p_slug: `house-a-${Date.now()}`,
      p_display_name: "House A",
    });
    expect(created.error).toBeNull();
    const householdId = created.data as string;

    const clientB = createClient(url!, anonKey!);
    await clientB.auth.signInWithPassword({ email: emailB, password });
    const leak = await clientB
      .from("households")
      .select("*")
      .eq("id", householdId)
      .maybeSingle();

    expect(leak.data).toBeNull();
  });
});
