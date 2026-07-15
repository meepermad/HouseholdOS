# Deployment (Vercel)

## Environment variables

Set in the Vercel project (Production + Preview as appropriate):

**Public**

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

**Server**

- `SUPABASE_SECRET_KEY` (optional for normal traffic; required for privileged ops/tests)
- `APP_URL` (production origin, e.g. `https://householdos.example.com`)
- `APP_ENV=production`
- `REGISTRATION_MODE=invite_only` (or `bootstrap_only` for first deploy)
- `BOOTSTRAP_EMAIL` when using bootstrap
- `INVITATION_TTL_HOURS=168`
- `DEFAULT_TIMEZONE=America/Chicago`
- `DEFAULT_CURRENCY=USD`

Never set the secret key as `NEXT_PUBLIC_*`.

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
- Static assets may be cached; a client banner prompts “Refresh to update” when a waiting worker is detected.
- Manifest (`public/manifest.webmanifest`): `display: standalone`, `start_url: /app`, theme/background colors aligned with the light page background (`#f3efe6`). Runtime `theme-color` meta tracks light/dark resolution.
- The site remains fully usable without installation.
