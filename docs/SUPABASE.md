# Supabase workflow

## Prerequisites

- Node.js 20+
- Docker Desktop (required for local `supabase start` / `db reset`)
- Supabase CLI via `npx` (pinned as a `devDependency`)

This machine may not have Docker. If `npm run db:start` fails, install Docker and retry. Migrations in `supabase/migrations/` remain the source of truth for both local and hosted databases.

## Common commands

```bash
npm run db:start
npm run db:status
npm run db:reset
npm run db:stop
npm run db:migration:new -- add_something
npm run db:types
```

## Login and link (hosted)

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
```

Never commit database passwords or access tokens. `.temp` / link artifacts are local.

Do **not** run `supabase db push` until migrations are reviewed and preferably validated with `db:reset` locally.

## Type generation

```bash
npm run db:types
```

Review `src/types/database.generated.ts`, then sync intentional changes into `src/types/database.ts` (hand-curated unions may remain).

## Migration history divergence

If local and remote histories diverge:

1. Do not rewrite committed migrations that already applied remotely on a shared environment.
2. Prefer additive forward migrations.
3. For disposable/empty remote (this foundation phase): reset remote carefully after backup confirmation, or recreate the project.
4. Use `supabase migration list` to compare local vs remote.

## Secret key usage

Use `SUPABASE_SECRET_KEY` only through `src/lib/supabase/privileged.ts` for tests/recovery. Ordinary app queries use the cookie SSR client and RLS.
