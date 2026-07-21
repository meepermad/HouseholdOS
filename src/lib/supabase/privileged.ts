/**
 * Privileged Supabase client (secret key).
 *
 * Permitted uses:
 * - Integration tests that need to seed multi-user fixtures
 * - Narrow operational recovery (e.g. admin tooling) documented at call sites
 * - Notification delivery worker (`src/lib/notifications/worker.ts`)
 * - Document / receipt OCR worker (`src/lib/receipts/worker.ts`)
 * - Export archive worker (`src/lib/export/worker.ts`)
 * - Household invitation Auth email (`src/lib/invitations/auth-invite.ts`)
 *   after a pending household_invitations row is already committed
 *
 * Never use this client for ordinary authenticated household queries.
 * Never import this module from Client Components.
 * Authorization must still be enforced in application logic when used.
 */

import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env/server";
import type { Database } from "@/types/database";

export function createPrivilegedClient() {
  const env = getServerEnv();
  if (!env.SUPABASE_SECRET_KEY) {
    throw new Error(
      "SUPABASE_SECRET_KEY is required for the privileged server client",
    );
  }
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SECRET_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

/** @deprecated Use createPrivilegedClient */
export const createAdminClient = createPrivilegedClient;
