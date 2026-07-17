# Environment configuration

HouseholdOS validates environment variables with Zod. Missing or malformed values fail at startup with a clear configuration error — there are no silent placeholder fallbacks.

## Public (browser-safe)

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase **API gateway** URL (`https://<ref>.supabase.co` or local `http://127.0.0.1:54321`). Dashboard URLs are rejected. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Publishable/anon key from Project Settings → API. Never put the secret key here. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | For Web Push UI | Public half of the VAPID pair. Generate with `npx web-push generate-vapid-keys`. |

## Server-only

| Variable | Required | Notes |
|---|---|---|
| `SUPABASE_SECRET_KEY` | Optional* | Secret/service_role key. Required for privileged client (tests/recovery) and notification worker. |
| `APP_URL` | Yes | Absolute app origin used for invite links and auth redirects. Default in schema: `http://localhost:3000`. |
| `APP_ENV` | Yes | `development` \| `test` \| `production`. |
| `REGISTRATION_MODE` | Yes | `bootstrap_only` \| `invite_only` \| `open`. `open` is **forbidden** in production. |
| `BOOTSTRAP_EMAIL` | When bootstrap | Normalized lowercase email allowed to register the first account. |
| `INVITATION_TTL_HOURS` | No | Default `168`. |
| `DEFAULT_TIMEZONE` | No | IANA timezone; default `America/Chicago`. |
| `DEFAULT_CURRENCY` | No | Three-letter uppercase code; default `USD`. |
| `NOTIFICATION_WORKER_SECRET` | For cron worker | Bearer secret (≥16 chars) for `POST /api/internal/notifications/dispatch`. |
| `NOTIFICATION_DELIVERY_ENABLED` | No | Default `false`. Set `true` only when VAPID + cron are ready. |
| `VAPID_PRIVATE_KEY` | For push send | Server-only. Never `NEXT_PUBLIC_*`. Keep stable across deploys. |
| `VAPID_SUBJECT` | For push send | `mailto:` or `https://` contact for VAPID. |
| `EMAIL_NOTIFICATIONS_ENABLED` | No | Default `false`. Email adapter stays disabled until fully configured. |
| `EMAIL_PROVIDER` / `EMAIL_API_KEY` / `EMAIL_FROM` | Optional | Reserved for a future provider integration. |
| `RECEIPT_OCR_PROVIDER` | No | `openai` \| `fixture` \| `disabled`. Default: `openai` when `OPENAI_API_KEY` is set, otherwise disabled/manual. |
| `OPENAI_API_KEY` | For receipt OCR | Server-only. Never `NEXT_PUBLIC_*`. When unset, receipt upload + manual review remain available. |

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
