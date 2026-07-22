# Deployment (Vercel)

## Environment variables

Set in the Vercel project (Production + Preview as appropriate):

**Public**

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

**Server**

- `SUPABASE_SECRET_KEY` (optional for normal traffic; required for privileged ops/tests and the notification worker)
- `APP_URL` (production origin — **required for Production**; must be `https://household-os-five.vercel.app`)
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

That is expected version skew, not data corruption.

**Password login does not use Server Actions.** It uses a progressive-enhancement form:

```html
<form method="post" action="/api/auth/sign-in">
```

- With JavaScript: JSON `POST` then hard `window.location.assign`
- Without JavaScript / before hydration: native **POST** body (never GET query credentials)
- Auth pages strip denylisted query keys and prompt a password reset

Other Server Actions still depend on matching builds. Recovery:

- One-shot hard reload (`householdos_action_skew_reload_attempted`)
- Visible “Your app was updated…” screen after a failed reload
- PWA update banner with build label
- NetworkOnly caching for `/login`, `/app`, and `/api/auth/*`

### Canonical production origin

Set **Production** environment variable:

```bash
APP_URL=https://household-os-five.vercel.app
```

Invitation join links and Supabase Auth `redirectTo` values are built from this origin via `getCanonicalAppOrigin()`. Production never falls back to `http://localhost:3000`. Missing or invalid `APP_URL` fails visibly (`Invitation links are not configured for production. Set APP_URL and redeploy.`).

Do **not** add `localhost` to production Supabase redirect URLs. In Supabase Dashboard → Authentication → URL Configuration, set Site URL / Redirect URLs to include:

- `https://household-os-five.vercel.app`
- `https://household-os-five.vercel.app/auth/callback`
- `https://household-os-five.vercel.app/join/**` (or specific `/join/*` paths as supported)

Household join authorization remains based on the HouseholdOS invitation token (hash), not merely the Supabase email redirect.

Safe readiness fields on `GET /api/ready`:

- `invitation_origin_configured`
- `invitation_origin_host`
- `invitation_origin_https`

Known production alias `household-os-meepermad.vercel.app` redirects (308) to the canonical host when `APP_ENV=production`. Preview / git branch aliases are not redirected. Preview may set `APP_URL` explicitly or rely on `VERCEL_URL`.

### Operator: Vercel Skew Protection

Some settings are dashboard-only:

1. Open the project → **Settings → Advanced**.
2. Confirm **Enable access to System Environment Variables** is on (required for deployment IDs).
3. Enable **Skew Protection** if the switch is available on your plan.
4. Optionally set retention (default is fine for short deploys).
5. **Redeploy** production after enabling so `VERCEL_SKEW_PROTECTION_ENABLED=1` and `VERCEL_DEPLOYMENT_ID` are present at build time.
6. In runtime logs / request headers, look for skew pinning (`x-deployment-id`, `dpl` query, or `__vdpl` cookie) when a stale client posts.
7. Deployments for this project are **Git-based** (push to `main`), not `vercel deploy --prebuilt`.

Do **not** set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` as the primary skew fix — it does not preserve removed action IDs across builds.

Do **not** add a custom `deploymentId` unless switching to prebuilt artifacts without Vercel’s build-time ID.

## PWA

Service worker is enabled in production via `@ducanh2912/next-pwa` (`next.config.ts`).

- Authenticated navigations under `/app`, `/onboarding`, and `/join` use Workbox **NetworkOnly** — do not cache household HTML or financial responses for offline reuse.
- Login, signup, recovery navigations and `/api/auth/*` are also **NetworkOnly** so stale Server Action references are not retained in HTML shells.
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
