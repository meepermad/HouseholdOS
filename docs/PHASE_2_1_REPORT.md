# Phase 2.1 report — Authenticated error recovery

## 1. Root cause of the lockout

Authenticated users could hit an App Router error boundary or unauthorized/not-found surface that **replaced the protected shell**. Sign out lived only in `ShellHeader` (and one profile-recovery branch). Root `error.tsx` offered **Try again** only. Auth cookies still redirected users away from `/login` into `/app`, so they could not log out without deleting cookies manually.

## 2. Error-boundary hierarchy before and after

**Before**

- `src/app/error.tsx` — Try again only
- No `global-error.tsx`
- No `(protected)/app/error.tsx`
- Unauthorized/not-found — link to `/app` only

**After**

- `src/app/error.tsx` — retry, recovery link, clear-household POST, logout POST
- `src/app/global-error.tsx` — standalone html/body + same escapes
- `src/app/(protected)/app/error.tsx` — protected segment boundary with escapes
- Unauthorized + not-found — household selection, recovery, clear, logout

## 3. Emergency logout design

`POST /auth/logout` (`src/app/auth/logout/route.ts`):

1. Cookie-aware SSR Supabase client (`createClient`)
2. `auth.signOut()` (ignores already-missing sessions)
3. Clears `householdos_current_household` with matching `path=/`, `httpOnly`, `sameSite=lax`, `secure` in production
4. Redirects to `/login?reason=signed_out`
5. GET redirects to `/recovery` (no state-changing GET)
6. No privileged client

Shared helper: `performEmergencyLogout` in `src/lib/recovery-actions.ts`. `signOutAction` and shell header also use this path.

## 4. Household-context reset design

`POST /auth/clear-household`:

1. Clears household cookie (same attributes)
2. Best-effort `user_preferences.current_household_id = null` when user resolvable
3. Does not touch memberships, expenses, or households
4. Redirects to `/app` or `/onboarding` (or safe `next`)
5. Continues if preference update fails after cookie clear

## 5. Files created

- `src/lib/recovery.ts`, `recovery-actions.ts`, `recovery-log.ts`
- `src/app/auth/logout/route.ts`, `src/app/auth/clear-household/route.ts`
- `src/app/recovery/page.tsx`
- `src/app/global-error.tsx`, `src/app/(protected)/app/error.tsx`
- `src/components/recovery-actions.tsx`, `unauthorized-household.tsx`
- `src/app/dev/trigger-error/page.tsx` (non-production only)
- Tests: `tests/unit/recovery.test.ts`, `tests/components/recovery-ui.test.tsx`, `tests/integration/recovery.test.ts`, `tests/e2e/recovery.spec.ts`
- `docs/PHASE_2_1_REPORT.md`

## 6. Files modified

- `src/app/error.tsx`, `not-found.tsx`, `(protected)/layout.tsx`, `[householdId]/layout.tsx`
- `src/proxy.ts` (public recovery/auth routes)
- `src/lib/household-context.ts` (clear stale cookie; database vs authorization)
- `src/app/(auth)/login/page.tsx`, `src/app/actions/auth.ts`, `src/components/shell-header.tsx`

## 7. Routes added

| Route | Method | Purpose |
|---|---|---|
| `/recovery` | GET | Public recovery UI |
| `/auth/logout` | POST | Emergency logout |
| `/auth/clear-household` | POST | Clear household selection |
| `/dev/trigger-error` | GET | Dev-only intentional throw |

## 8. Cookie behavior

- Set: `httpOnly`, `sameSite=lax`, `path=/`, `secure` in production, long maxAge
- Clear: set empty value with `maxAge=0` and same flags (reliable deletion)
- Logout clears HouseholdOS context cookie; Supabase session cookies cleared via `signOut()`

## 9. Session behavior

- Invalid/expired sessions → login with `reason=session_expired` where applicable
- `/recovery`, `/auth/logout`, `/auth/clear-household` are public in proxy
- Login no longer forces authenticated users into arbitrary household URLs; uses `safeRecoveryDestination`
- Open redirects rejected via `safeRedirectPath` / `safeRecoveryDestination`

## 10. Household-context loop corrections

- Invalid cookie → cleared, fall through to prefs / first authorized / onboarding
- Unauthorized URL household → safe unauthorized UI without writing that id into preferences
- No memberships → onboarding
- DB membership query failure → `database_failure` recoverable UI, not silent auth mislabel

## 11. Tests added

- Unit: recovery classification, redirects, cookie options, error refs
- Component: protected/root error UI, forms, unauthorized escapes
- Integration: preference clear preserves membership; removed member denied; idempotent signOut
- E2E: public recovery, logout→login, protected redirect smoke

## 12. Commands and results

| Command | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint` | Pass (0 errors) |
| `npm test` (recovery unit/component/integration) | Pass (13) |
| `npm run build` | Pass |
| `npm run test:e2e -- tests/e2e/recovery.spec.ts` | Pass |
| Privileged client in recovery routes | Not used |

Manual cookie-corruption verification recommended once on a local signed-in session.

## 13. Manual verification checklist

1. Sign in → valid household
2. Corrupt `householdos_current_household` → refresh → `/app` selection or recovery, not trap
3. Clear selected household → returns to selector
4. Visit `/dev/trigger-error` in development → Sign out works
5. Sign in again → data intact

## 14. Security findings

- Logout/clear use POST
- No privileged client on recovery routes
- External redirects rejected
- Error UI does not dump stacks/SQL/tokens
- Dev error route 404s in production

## 15. Known limitations

- Full browser multi-user “invalid cookie → clear → amend expense” matrix still partially covered by integration helpers rather than one giant Playwright file
- Global error cannot rely on Tailwind/theme tokens (standalone styles by design)

## 16. Can an authenticated user still become trapped?

**No, not by the reported mechanism.** Every error/unauthorized/not-found/recovery surface offers Sign out and Clear household via routes that do not require the protected shell.

## 17. Exact recommended next phase

**Phase 3: payment recording, partial settlements, confirmation, disputes, and obligation reconciliation** — now unblocked after recovery escape hatches.
