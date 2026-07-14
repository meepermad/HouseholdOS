# Architecture (Foundation phase)

HouseholdOS is a private, mobile-first household management PWA. This phase establishes identity, multi-household tenancy, membership responsibilities, invitations, settings, RLS, audit events, and the protected application shell.

## Stack

- Next.js App Router (`src/app`) + TypeScript + Tailwind CSS v4
- Supabase Auth, PostgreSQL, Storage (avatars deferred)
- Zod validation; React Hook Form available for complex forms
- Vitest (unit/component/integration) + Playwright (e2e)
- Request interception via `src/proxy.ts` (Next.js 16; not legacy `middleware.ts`)

## Trust boundaries

| Client | Module | Key | RLS |
|---|---|---|---|
| Browser | `src/lib/supabase/client.ts` | publishable | yes |
| Authenticated server | `src/lib/supabase/server.ts` | publishable + cookies | yes |
| Privileged server | `src/lib/supabase/privileged.ts` | secret | bypass — use sparingly |

## Household context (hybrid)

- Canonical routes: `/app/[householdId]/...`
- Cookie `householdos_current_household` + `user_preferences.current_household_id`
- Revalidated on every household layout load; revoked membership clears access

## Responsibilities

Normalized in `household_membership_roles`:

- `member`
- `household_coordinator`
- `financial_coordinator`

No comma-separated role strings. No self-promotion.

## Out of scope this phase

## Out of scope for Phase 2 completion

Receipt OCR, payment transfer integrations (Venmo/Zelle/Plaid), inventory, chores, supplies, maintenance agreements, email delivery.

Phase 2 delivered: manual itemized expenses, allocation engine, reimbursement obligations, confirm/void/amend RPCs, Money UI.

