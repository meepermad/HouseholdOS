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

Service worker is enabled in production via `@ducanh2912/next-pwa`. Do not cache authenticated household HTML/API responses aggressively; the default configure path should exclude Next document navigation from opaque offline caching for private routes.
