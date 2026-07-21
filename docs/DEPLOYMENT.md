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

**Storage**

- Private Supabase Storage bucket `maintenance-evidence` is created by Phase 7B migrations (JPEG/PNG/WebP/PDF, 8 MiB). No public object URLs; app uses signed access for authorized viewers.

Never set the secret key, worker secret, VAPID private key, or email API key as `NEXT_PUBLIC_*`.

### After a leaked local env archive

If `.env.local` (or similar) was shared outside the private operator machine, manually rotate `SUPABASE_SECRET_KEY` and all worker secrets in Supabase + Vercel before treating production as trustworthy. See [ENVIRONMENT.md](./ENVIRONMENT.md#credential-rotation-operator). Do not rotate credentials via git commits.

## Calendar feeds

Personal iCalendar feeds are served at `/api/calendar/feed/{token}.ics` using the privileged Supabase client. Ensure `APP_URL` matches the public origin so feed URLs shown at create/regenerate are correct. Treat feed URLs like passwords; revoking a token stops future access (clients may keep a cached copy briefly).

The notification dispatch worker also extends recurring-event occurrence horizons (`claim_calendar_horizon_extensions`) and chore horizons (`claim_chore_horizon_extensions`), and records a safe heartbeat for coordinator health under **Settings → Operations**. Keep the existing cron → dispatch route schedule running so reminders and horizons stay fresh.

## Build

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Auth callback

Add production Site URL and `https://<your-domain>/auth/callback` in the Supabase Dashboard redirect allowlist.

## Deploy skew (Server Actions)

After each production deploy, open tabs (especially the installed PWA) may still hold Server Action IDs from the previous build. Invoking those actions logs:

`Failed to find Server Action. This request might be from an older or newer deployment.`

That is expected version skew, not data corruption. Users should hard-refresh or use the in-app “Refresh to update” banner. Error boundaries auto-reload once when this message is detected.

Optional hardening on Vercel:

- Enable **Skew Protection** for the project when your plan supports it.
- Set a stable `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (base64 AES-256) at **build and runtime** so multi-instance encryption stays consistent (see [Next.js docs](https://nextjs.org/docs/messages/failed-to-find-server-action)). Generate once and store only in Vercel env — never commit the key.

## PWA

Service worker is enabled in production via `@ducanh2912/next-pwa` (`next.config.ts`).

- Authenticated navigations under `/app`, `/onboarding`, and `/join` use Workbox **NetworkOnly** — do not cache household HTML or financial responses for offline reuse.
- Custom worker source (`worker/index.ts`) handles `push`, `notificationclick`, and `SKIP_WAITING` for update activation.
- Static assets may be cached; a client banner prompts “Refresh to update” when a waiting worker is detected (activates the new worker, then reloads).
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

## Source packaging

```bash
npm run package:source
```

Creates a `git archive` tarball of tracked source only. The packaging gate rejects `.env*` (except `.env.example`), `node_modules`, `.next`, test artifacts, and OCR/PDF build outputs.

## Dependency advisories

After `npm audit --omit=dev` / `npm outdated` (Security-D):

- **Accepted (deferred):** `@ducanh2912/next-pwa` / Workbox `serialize-javascript` advisories — force-fix would downgrade next-pwa to 8.x / Next to 9.x (breaking). Prefer waiting for a compatible Workbox/plugin release; re-test PWA install, NetworkOnly `/app`, OCR workers, and push after any update.
- **Accepted (deferred):** transitive `postcss` XSS advisory via Next 16.2.x — `npm audit fix --force` proposes Next 9.3.3 (unsafe). Track Next patch releases.
- Patch non-breaking wanted updates (`@supabase/supabase-js`, Tailwind) on a routine maintenance window after PWA/OCR smoke.
