# Foundation phase final report

## 1. Repository state before implementation

Phase 0 scaffold existed: Next.js 16.2.10 App Router, `@supabase/ssr`, Zod, four migrations with `owner`/`admin`/`member`, `/households` routes, thin tests. Not linked to hosted Supabase. Docker unavailable.

## 2. Architecture decisions

- Rewrote foundation migrations (host DB treated as disposable).
- Responsibilities model: `member` / `household_coordinator` / `financial_coordinator` in `household_membership_roles`.
- Hybrid household context: `/app/[householdId]/...` + HttpOnly cookie + `user_preferences`.
- Env: publishable/secret naming; split public vs server Zod schemas.
- Auth via `@supabase/ssr` + `src/proxy.ts` (Next 16).
- Privileged client isolated in `privileged.ts` (`server-only`).
- Registration policy: `bootstrap_only` | `invite_only` | `open` (open blocked in production).

## 3. Supabase initialization completed

- `supabase/config.toml`, migrations, `seed.sql` present.
- CLI pinned as `devDependency`; scripts `db:start|stop|status|reset|migration:new|types|link`.

## 4. Local Supabase status

**Docker is not on PATH.** Local `supabase start` / `db reset` were **not** run successfully in this environment. Prerequisite: install Docker Desktop and re-run `npm run db:start` then `npm run db:reset`.

## 5. Hosted-project link status

**Not linked** (no `supabase/.temp`). Operator must run `npx supabase login` and `npm run db:link`. Do not push migrations until reviewed.

## 6. Environment variables required

See [ENVIRONMENT.md](ENVIRONMENT.md). Existing `.env.local` keys were preserved; missing non-secret keys were appended (`APP_URL`, `APP_ENV`, `REGISTRATION_MODE=invite_only`, etc.).

## 7. Files created (high level)

- `src/lib/env/*`, errors, membership, navigation, household-context, invitations/delivery
- Auth/household actions; protected `/app`, `/onboarding`, `/join`, auth routes
- New migrations `20260714140000`–`40400`
- Docs: ENVIRONMENT, SUPABASE, DASHBOARD_SETUP, DEPLOYMENT, FOUNDATION_REPORT
- Expanded unit/component/integration/e2e tests

## 8. Files modified

- `package.json`, `vitest.config.ts`, `.env.example`, README, architecture/permissions/audit docs
- Supabase clients, proxy, PWA config, types, validations, permissions, tokens, audit

## 9. Migrations added

1. `20260714140000_foundation_schema.sql`
2. `20260714140100_rls_policies.sql`
3. `20260714140200_household_rpcs.sql`
4. `20260714140300_invitation_rpcs.sql`
5. `20260714140400_membership_rpcs.sql`

Prior Phase 0 migrations removed (rewrite).

## 10. Database tables added

`profiles`, `households`, `household_settings`, `household_memberships`, `household_membership_roles`, `household_invitations`, `user_preferences`, `audit_events`

## 11. RLS policies added

Per-table policies + helpers `is_active_member`, `has_responsibility`. Audit append-only. Invitation preview via security definer RPC.

## 12. Routes added

`/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/callback`, `/onboarding`, `/join/[token]`, `/join/paste`, `/app`, `/app/[householdId]`, settings profile/household/members, `/api/health`, `/api/ready`

## 13. Authentication flows implemented

Sign-up/sign-in, email callback exchange, forgot/reset password, logout, safe `next` redirects, profile ensure/recovery, registration policy enforcement.

## 14. Invitation flows implemented

Hashed tokens, create/preview/accept/decline/revoke RPCs, copyable `/join/<token>` link, email delivery stub.

## 15. Tests added

Unit: env, registration, tokens, permissions, membership/navigation. Component: ActionForm, HouseholdSwitcher. Integration RLS (skipped without Supabase). E2E smoke (env/browser gated).

## 16. Commands run

`npm install`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`

## 17. Command results

| Command | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint` | Pass (0 errors) |
| `npm test` | 36 passed, 1 skipped (RLS without stack) |
| `npm run build` | Pass |
| `npm run db:reset` | Not run — Docker unavailable |
| Playwright full matrix | Not fully executed — browsers/Docker gated |
| Hosted `db push` | Not run — not linked; requires review |

## 18. Required manual Supabase configuration

See [DASHBOARD_SETUP.md](DASHBOARD_SETUP.md). Site URL, redirect URLs, keys, email confirmation — **not verified** in this session.

## 19. Required Vercel configuration

See [DEPLOYMENT.md](DEPLOYMENT.md). Set public + server env vars; never expose secret key publicly.

## 20. Security findings

- RLS enabled on all foundation tables; coordinators required for invites/role changes.
- Raw invite tokens never stored; secret key server-only.
- Auth errors do not enumerate accounts on forgot-password.
- Dashboard URLs rejected in env validation.
- Remaining risks: membership UPDATE policy is somewhat broad (mitigated by RPC for role changes); apply migrations before storing real data; configure redirect allowlist in Dashboard.

## 21. Known limitations

- No local Supabase verification without Docker.
- No hosted migration apply in this session.
- Email delivery not wired.
- Full Playwright multi-user matrix not completed here.
- Avatars path column ready; Storage not configured.

## 22. Deferred work

Expenses, receipts, reimbursements engine, inventory, chores, supplies, maintenance, agreements, meetings, documents, move-in/out, reports/exports, invite email.

## 23. Recommended next phase

**Manual itemized-expense and reimbursement-calculation engine** (allocations, personal exclusions, obligations, confirmation, financial audit trails) built on this membership/household foundation.
