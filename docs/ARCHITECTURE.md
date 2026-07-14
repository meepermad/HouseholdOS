# HouseholdOS Architecture (Phase 0)

HouseholdOS is a private, mobile-first household management PWA. Phase 0 establishes identity, multi-household tenancy, membership, invitations, settings, RLS, and audit foundations.

## Stack

- Next.js App Router (`src/app`) + TypeScript + Tailwind CSS
- Supabase Auth, PostgreSQL, Storage (Storage wired later for receipts)
- Zod validation at mutation boundaries
- Vitest (unit/integration) + Playwright (critical e2e)
- PWA shell via `@ducanh2912/next-pwa` + web manifest

## Conventions

- Every household-owned row includes `household_id`
- Monetary amounts are integer **cents** only (`src/lib/money.ts`) — no floating-point financial math
- Default timezone `America/Chicago`, currency `USD`
- Server actions recalculate/validate financial totals (later phases)
- Confirmed financial records are immutable; corrections use amendments/reversals + audit events
- Receipt OCR never creates confirmed reimbursements (later phases)
- Group chat stays external; HouseholdOS stores commitments, money, ownership, evidence

## Request path

1. `src/proxy.ts` refreshes Supabase auth cookies
2. Route layouts enforce authentication for `(app)` routes
3. Server actions validate with Zod, check permissions, mutate via RLS/RPC
4. Meaningful household mutations emit `audit_events`

## Key folders

| Path | Purpose |
|---|---|
| `src/app` | Routes, layouts, server actions |
| `src/lib` | Money, permissions, audit, validations, Supabase clients |
| `supabase/migrations` | Schema, RLS, transactional RPCs |
| `tests/unit` | Pure logic tests |
| `tests/integration` | RLS checks against local Supabase |
| `tests/e2e` | Playwright membership flows |
| `docs` | Architecture, permissions, audit |

## Out of Phase 0

Expenses, reimbursements, receipts/OCR, inventory, chores, shopping, agreements, and export jobs.
