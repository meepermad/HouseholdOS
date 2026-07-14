# Supabase Dashboard configuration

Manual settings required in the hosted Supabase project.

## API keys

1. Project Settings → API
2. Confirm **Project URL** is the API gateway (`https://<ref>.supabase.co`), not a Dashboard URL
3. Copy **anon / publishable** key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
4. Copy **service_role / secret** key → `SUPABASE_SECRET_KEY` (server-only)

**Status (Phase 1B):** Linked project name **HouseholdOS**, ref `bdndibbupvyihzfjmwkj`. Keys exist in local `.env.local` (values not printed).

## Auth URLs

Authentication → URL Configuration:

| Setting | Local value |
|---|---|
| Site URL | `http://localhost:3000` |
| Redirect URLs | `http://localhost:3000/auth/callback` |
| | `http://localhost:3000/reset-password` |

Production (later): add production origin + `/auth/callback`.

**Status:** Required values documented. **Not verified live in the Dashboard UI** during Phase 1B — configure before real roommate onboarding.

## Before User Created hook (Auth-level invite gating)

Migration `20260714151000` created `public.hook_before_user_created`.

**Activate manually:**

1. Authentication → Hooks → **Before User Created**
2. Enable the hook
3. Choose Postgres function
4. Select `public.hook_before_user_created`
5. Equivalent URI: `pg-functions://postgres/public/hook_before_user_created`

Until activated, invite-only enforcement is **application-layer only**. RLS still blocks uninvited users from household data (verified by linked integration tests). Residual risk: uninvited Auth accounts can still be created via public signup until the hook is enabled.

Policy row: `public.auth_registration_policy` (single row `id=1`). Update `mode`, `bootstrap_email`, and `allow_test_emails` via privileged SQL (no authenticated policies on this table). Integration tests use the domain `hos-itest.local` when `allow_test_emails=true`.

Local `supabase/config.toml` already enables the hook for Docker-based local Auth.

## Email

- Enable or disable email confirmation intentionally
- Confirm / recovery templates should target `/auth/callback`
- Review Auth rate limits

**Status:** TODO verify in Dashboard.

## Storage

`profiles.avatar_path` exists; Storage bucket setup deferred.
