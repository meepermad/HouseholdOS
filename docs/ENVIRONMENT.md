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
| `NOTIFICATION_WORKER_SECRET` | For cron worker | Bearer secret (≥16 chars) for `POST /api/internal/notifications/dispatch` only. |
| `DOCUMENT_JOB_WORKER_SECRET` | For OCR worker | Bearer secret (≥16 chars) for `POST /api/internal/documents/process` only. |
| `EXPORT_WORKER_SECRET` | For export worker | Bearer secret (≥16 chars) for `POST /api/internal/exports/process` only. |
| `SYNC_WORKER_SECRET` | For sync catch-up worker | Bearer secret (≥16 chars) for `POST /api/internal/sync/process` only. Client outbox uses session `/api/sync/push`. |
| `NOTIFICATION_DELIVERY_ENABLED` | No | Default `false`. Set `true` only when VAPID + cron are ready. |
| `VAPID_PRIVATE_KEY` | For push send | Server-only. Never `NEXT_PUBLIC_*`. Keep stable across deploys. |
| `VAPID_SUBJECT` | For push send | `mailto:` or `https://` contact for VAPID. |
| `EMAIL_NOTIFICATIONS_ENABLED` | No | Default `false`. Email adapter stays disabled until fully configured. |
| `EMAIL_PROVIDER` / `EMAIL_API_KEY` / `EMAIL_FROM` | Optional | Reserved for a future provider integration. |
| `RECEIPT_OCR_PROVIDER` | No | `local_tesseract` \| `openai` \| `fixture` \| `disabled`. Default: `local_tesseract` (on-device). Cloud is never selected merely because `OPENAI_API_KEY` exists — set `RECEIPT_OCR_PROVIDER=openai` explicitly. |
| `OPENAI_API_KEY` | Optional cloud OCR | Server-only. Never `NEXT_PUBLIC_*`. Required only when `RECEIPT_OCR_PROVIDER=openai`. Local OCR needs no secrets. |

Worker secrets must never appear in client bundles, URLs, notification payloads, logs, or browser storage. Each secret authorizes only its own endpoint family.

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

## Credential rotation (operator)

If production credentials were ever included in a shared local archive (for example a source ZIP that contained `.env.local`), rotate them in the provider dashboards — do **not** attempt rotation through application source code.

Rotate and re-verify, in order:

1. `SUPABASE_SECRET_KEY` (Supabase Dashboard → Project Settings → API) — update Vercel env + local `.env.local`, then confirm privileged server ops and workers.
2. Worker bearer secrets: `NOTIFICATION_WORKER_SECRET`, `DOCUMENT_JOB_WORKER_SECRET`, `EXPORT_WORKER_SECRET`, `SYNC_WORKER_SECRET` — update Vercel and any cron/Vault references; hit each `/api/internal/*` endpoint with the new secret.
3. `VAPID_PRIVATE_KEY` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` if the private half may have leaked (requires a production rebuild after public key change).
4. Optional provider secrets (`OPENAI_API_KEY`, Google Calendar client secret, email API keys) if present in the archive.

Never commit `.env.local` or other real environment files. Never print secret values into chat, logs, tests, or reports. After rotation, smoke-test notification dispatch, document/OCR jobs, export processing, and sync worker auth.
