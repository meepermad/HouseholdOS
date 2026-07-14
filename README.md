# HouseholdOS

Private, mobile-first household management PWA for shared expenses, ownership, responsibilities, and commitments.

**Foundation phase** ships: auth, private registration policy, profiles, households, memberships/responsibilities, invitations, settings, RLS, audit events, protected shell, and tests. Domain features (expenses, OCR, inventory, chores, etc.) come later.

## Stack

- Next.js App Router + TypeScript + Tailwind CSS
- Supabase (Auth, PostgreSQL, RLS)
- Zod · Vitest · Playwright
- Installable PWA shell
- Defaults: `America/Chicago`, `USD`, integer cents for money

## Setup

```bash
cp .env.example .env.local
# Fill values — see docs/ENVIRONMENT.md
# Do not overwrite an existing .env.local with secrets from chat/logs

npm install

# Local Supabase (requires Docker)
npm run db:start
npm run db:reset

npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Next.js development server |
| `npm run build` | Production build |
| `npm test` | Vitest unit + component + integration |
| `npm run test:e2e` | Playwright |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm run db:*` | Supabase local/link/types helpers |

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Permissions](docs/PERMISSIONS.md)
- [Audit](docs/AUDIT.md)
- [Environment](docs/ENVIRONMENT.md)
- [Supabase](docs/SUPABASE.md)
- [Dashboard setup](docs/DASHBOARD_SETUP.md)
- [Deployment](docs/DEPLOYMENT.md)

## Invite flow

Household coordinators create invites in **Settings → Members**. The UI returns a copyable `/join/<token>` URL (email delivery deferred). Invitees register/sign in with the invited email and accept.
