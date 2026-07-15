# Architecture

HouseholdOS is a private, mobile-first household management PWA. Identity, multi-household tenancy, membership responsibilities, invitations, settings, RLS, audit events, the protected application shell, and manual expenses are in place.

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

## Appearance theme

- Modes: `system` | `light` | `dark` stored in `localStorage` (`householdos-theme`) and optionally `user_preferences.theme`
- Bootstrap script on `<html>` applies the local preference before paint (no FOUC)
- Reconciliation: localStorage paints first; when an authenticated DB preference loads, **DB wins** and overwrites localStorage (cross-device sync)
- User changes write localStorage immediately, then upsert the DB row when signed in
- Sign-out does not clear the device theme key (not financial PII); session/household UI must still clear so another user’s content is not shown
- Semantic CSS variables in `globals.css` drive light/dark via the `.dark` class — components request surfaces/actions, not raw slate hex

## Application shell

- Mobile: bottom navigation (Home, Money, Settings) with safe-area padding
- Desktop (`lg+`): sidebar navigation + wider content (capped ~`max-w-5xl`)
- Unimplemented domains (Tasks, House, Records) are hidden from primary nav
- Standalone PWA: safe-area and optional in-app Back control; authenticated navigations are `NetworkOnly` in the service worker

## Loading and mutations

- Route-level `loading.tsx` skeletons per segment (not a single global spinner)
- Suspense around secondary money sections after membership authz
- `ActionForm` pending labels are action-specific; financial confirms remain server-authoritative (no offline mutation queue)

## Responsibilities

Normalized in `household_membership_roles`:

- `member`
- `household_coordinator`
- `financial_coordinator`

No comma-separated role strings. No self-promotion.

## Out of scope (current)

Receipt OCR, payment settlements / transfer integrations, inventory, chores, supplies, grocery/recipes, full offline sync, email delivery.
