# Environment configuration

HouseholdOS validates environment variables with Zod. Missing or malformed values fail at startup with a clear configuration error — there are no silent placeholder fallbacks.

## Public (browser-safe)

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase **API gateway** URL (`https://<ref>.supabase.co` or local `http://127.0.0.1:54321`). Dashboard URLs are rejected. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Publishable/anon key from Project Settings → API. Never put the secret key here. |

## Server-only

| Variable | Required | Notes |
|---|---|---|
| `SUPABASE_SECRET_KEY` | Optional* | Secret/service_role key. Required only when using the privileged client (tests/recovery). |
| `APP_URL` | Yes | Absolute app origin used for invite links and auth redirects. Default in schema: `http://localhost:3000`. |
| `APP_ENV` | Yes | `development` \| `test` \| `production`. |
| `REGISTRATION_MODE` | Yes | `bootstrap_only` \| `invite_only` \| `open`. `open` is **forbidden** in production. |
| `BOOTSTRAP_EMAIL` | When bootstrap | Normalized lowercase email allowed to register the first account. |
| `INVITATION_TTL_HOURS` | No | Default `168`. |
| `DEFAULT_TIMEZONE` | No | IANA timezone; default `America/Chicago`. |
| `DEFAULT_CURRENCY` | No | Three-letter uppercase code; default `USD`. |

\*Ordinary household queries use the cookie-based authenticated server client and remain subject to RLS.

## Local setup

```bash
cp .env.example .env.local
# Fill real values. Do not commit .env.local.
```

Do not import server environment modules into Client Components.
Do not log parsed environment objects (they may contain secrets).

## Dashboard key names

Supabase Dashboard may still label keys as **anon** and **service_role**. Map:

- anon / publishable → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- service_role / secret → `SUPABASE_SECRET_KEY`
