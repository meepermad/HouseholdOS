# HouseholdOS

Private, mobile-first household management PWA for shared expenses, ownership, responsibilities, and commitments.

**Phase 0** ships foundations only: auth, households, memberships, invitations, settings, RLS, audit events, and test harness. Domain features (expenses, OCR, inventory, chores, etc.) come later.

## Stack

- Next.js App Router + TypeScript + Tailwind CSS
- Supabase (Auth, PostgreSQL, Storage, RLS)
- Zod · Vitest · Playwright
- Installable PWA shell
- Defaults: `America/Chicago`, `USD`, integer cents for money

## Guardrails

- Store money as integer cents; never use floating-point for financial math
- Recalculate financial totals on the server (later phases)
- Scope household-owned rows by `household_id`
- Confirmed financial records are not silently edited or deleted
- Corrections create amendments/reversals + audit events
- Receipt OCR never directly creates confirmed reimbursements
- RLS is enabled before production data is used

## Setup

```bash
cp .env.example .env.local
# Fill NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

npx supabase start
npx supabase db reset

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Next.js development server |
| `npm run build` | Production build |
| `npm test` | Vitest unit + integration |
| `npm run test:e2e` | Playwright critical flows (`npx playwright install` required; needs free disk space for browsers) |
| `npm run db:reset` | Reset local Supabase schema/seed |
| `npm run typecheck` | TypeScript check |

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Permissions](docs/PERMISSIONS.md)
- [Audit](docs/AUDIT.md)

## Phase 0 invite flow

Owners/admins create invites in the household UI. Phase 0 returns a shareable invite URL (email delivery is deferred). Invitees sign in with the invited email and accept at `/invites/[token]`.
