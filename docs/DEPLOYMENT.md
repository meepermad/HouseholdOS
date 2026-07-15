# Deployment (Vercel)

## Environment variables

Set in the Vercel project (Production + Preview as appropriate):

**Public**

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

**Server**

- `SUPABASE_SECRET_KEY` (optional for normal traffic; required for privileged ops/tests and the notification worker)
- `APP_URL` (production origin, e.g. `https://householdos.example.com`)
- `APP_ENV=production`
- `REGISTRATION_MODE=invite_only` (or `bootstrap_only` for first deploy)
- `BOOTSTRAP_EMAIL` when using bootstrap
- `INVITATION_TTL_HOURS=168`
- `DEFAULT_TIMEZONE=America/Chicago`
- `DEFAULT_CURRENCY=USD`
- `NOTIFICATION_WORKER_SECRET` (bearer secret for `POST /api/internal/notifications/dispatch`)
- `NOTIFICATION_DELIVERY_ENABLED=false` until VAPID + worker URL + cron are ready
- `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` (stable key pair; generate once with `npx web-push generate-vapid-keys`)
- Optional email: `EMAIL_NOTIFICATIONS_ENABLED`, `EMAIL_PROVIDER`, `EMAIL_API_KEY`, `EMAIL_FROM`

**Public**

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (pair with `VAPID_PRIVATE_KEY`)

Never set the secret key, worker secret, VAPID private key, or email API key as `NEXT_PUBLIC_*`.

## Build

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Auth callback

Add production Site URL and `https://<your-domain>/auth/callback` in the Supabase Dashboard redirect allowlist.

## PWA

Service worker is enabled in production via `@ducanh2912/next-pwa` (`next.config.ts`).

- Authenticated navigations under `/app`, `/onboarding`, and `/join` use Workbox **NetworkOnly** — do not cache household HTML or financial responses for offline reuse.
- Custom worker source (`worker/index.ts`) handles `push` and `notificationclick` with same-origin deep-link validation.
- Static assets may be cached; a client banner prompts “Refresh to update” when a waiting worker is detected.
- Manifest (`public/manifest.webmanifest`): `display: standalone`, `start_url: /app`, theme/background colors aligned with the light page background (`#f3efe6`). Runtime `theme-color` meta tracks light/dark resolution.
- The site remains fully usable without installation.
- iPhone Web Push requires Add to Home Screen + opening the installed PWA before “Enable notifications”.

## Notification worker (Supabase Cron)

Preferred scheduler: **Supabase Cron** → authenticated HTTP `POST` → Next.js route  
`/api/internal/notifications/dispatch` (Bearer `NOTIFICATION_WORKER_SECRET`).

Do not rely on frequent Vercel Hobby cron. Keep `NOTIFICATION_DELIVERY_ENABLED=false` until:

1. Stable VAPID keys are set in Vercel (and `NEXT_PUBLIC_VAPID_PUBLIC_KEY` rebuilt).
2. `NOTIFICATION_WORKER_SECRET` is set (16+ chars).
3. Worker URL is stored outside git (Supabase Vault / Dashboard secrets), e.g. `https://<your-domain>/api/internal/notifications/dispatch`.
4. Cron job is enabled to hit that URL about once per minute with `Authorization: Bearer <secret>`.

Operator sketch (configure in Dashboard / SQL editor — do **not** commit secrets):

```sql
-- Requires pg_cron + pg_net (or Supabase scheduled functions).
-- Store URL + secret in Vault, then schedule:
-- select cron.schedule(
--   'householdos-notification-dispatch',
--   '* * * * *',
--   $$ select net.http_post(
--        url := (select decrypted_secret from vault.decrypted_secrets where name = 'notification_worker_url'),
--        headers := jsonb_build_object(
--          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'notification_worker_secret'),
--          'Content-Type', 'application/json'
--        ),
--        body := '{}'::jsonb
--      ); $$
-- );
```

Empty worker runs exit quickly when delivery is disabled or the queue is empty. Overlapping invocations are safe (SKIP LOCKED claim).
