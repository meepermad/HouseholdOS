import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type CachedSession = {
  client: SupabaseClient<Database>;
  userId: string;
  accessToken: string;
};

const cache = new Map<string, CachedSession>();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns a reuseable authenticated client. Caches by email to avoid
 * Supabase Auth sign-in rate limits across sequential integration tests.
 */
export async function getAuthedClient(
  email: string,
  password: string,
): Promise<CachedSession> {
  const hit = cache.get(email);
  if (hit) return hit;

  let lastError: unknown;
  for (let attempt = 0; attempt < 6; attempt++) {
    if (attempt > 0) {
      await sleep(Math.min(30_000, 1_000 * 2 ** attempt));
    }
    const res = await createClient<Database>(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }).auth.signInWithPassword({ email, password });
    if (!res.error && res.data.session && res.data.user) {
      const client = createClient<Database>(url, publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          headers: {
            Authorization: `Bearer ${res.data.session.access_token}`,
          },
        },
      });
      const session: CachedSession = {
        client,
        userId: res.data.user.id,
        accessToken: res.data.session.access_token,
      };
      cache.set(email, session);
      return session;
    }
    lastError = res.error;
    const msg = (res.error?.message ?? "").toLowerCase();
    if (!msg.includes("rate limit")) break;
  }
  throw lastError;
}

export function clearAuthedClientCache() {
  cache.clear();
}
