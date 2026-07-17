# Architecture

HouseholdOS is a private, mobile-first household management PWA. Identity, multi-household tenancy, membership responsibilities, invitations, settings, RLS, audit events, the protected application shell, manual expenses, and external payment settlement recording are in place.

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

- Mobile: fixed bottom nav with notch/home-indicator safe areas (`viewport-fit=cover`, `shell-top`, `app-main-pad`, `safe-pb`)
- Desktop (`lg+`): sidebar navigation + wider content (capped ~`max-w-5xl`)
- Nav config lives in `src/lib/nav-items.ts`:
  - Bottom bar shows only enabled `surface: "primary"` items (capped at 4) so new domains do not crowd the thumb bar
  - Sidebar lists all enabled items (primary + `more`)
  - Primary: Home · Calendar · Chores · Money. Settings and Inbox live under `more`
  - Unshipped domains (Records) stay `enabled: false`
  - House is enabled under `surface: "more"` (Phase 6 resource hub)
  - When primary slots are full, ship new roots as `surface: "more"` (and later a More screen) instead of growing the bottom bar endlessly
- Standalone PWA: safe-area chrome and optional in-app Back control; authenticated navigations are `NetworkOnly` in the service worker

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

## Settlement ledger

HouseholdOS does **not** transfer money. Members record external payments (Venmo, Zelle, cash, etc.) as metadata.

- `reimbursement_obligations.current_amount_cents` = **effective** amount after expense correction (not open balance)
- Official outstanding is ledger-derived via `obligation_balances_v`:

```text
effective − confirmed allocations − active waivers = official outstanding
projected = official − submitted (pending) allocations
```

- Payment lifecycle: `draft` → `submitted` → `confirmed` | `rejected` | `cancelled`; `confirmed` → `reversed` (once)
- Private external references / private notes live in `payment_private_details` (RLS: sender ∪ recipient only)
- Amendments/voids after payment preserve payment history and may create refund obligations (`obligation_kind = refund`)

## Notifications (outbox + delivery)

Pipeline:

```text
Domain transaction
→ durable notification_events (same DB transaction)
→ user_notifications fan-out + notification_deliveries queue
→ protected Next.js worker (Supabase Cron → POST /api/internal/notifications/dispatch)
→ Web Push (VAPID) or optional email adapter
→ sent | retry | expired | dead_letter
```

Guarantees:

- Financial RPCs emit `notification_events` inside the same plpgsql transaction as the money mutation. Rolled-back mutations create no events. Delivery failure never rolls back money.
- Fan-out and delivery rows are idempotent (`idempotency_key`, unique `(event_id, user_id)`, unique `(event_id, user_id, channel)`).
- Payloads store routing keys only (`source_type`, `source_id`) — never private payment references, secrets, or invite tokens.
- Ordinary clients cannot claim deliveries or modify delivery status. The privileged Supabase client may be imported only from `src/lib/supabase/privileged.ts` and `src/lib/notifications/worker.ts`.
- Lock-screen push content respects `preview_mode` (`generic` default | `detailed`). Amounts and private notes stay off the lock screen.
- Quiet hours defer push/email `available_at`; in-app rows appear immediately. Daily digest mode is preference-aware.
- `scheduled_notification_requests` backs calendar and chore reminders. Domain RPCs create/cancel rows transactionally; the notification worker also extends calendar and chore occurrence materialization horizons and records a safe heartbeat for coordinator health.
- Email adapter exists but stays disabled until `EMAIL_NOTIFICATIONS_ENABLED` and provider env are configured.

Event catalog (TypeScript): `src/lib/notifications/catalog.ts` — payments, calendar, and active `chore.*` / responsibility transfer events.

Scheduler choice: **Supabase Cron** calls the Next.js worker (not Vercel Hobby cron). Secrets and worker URL live in Vault / dashboard config — never in source-controlled SQL.

## Shared calendar (Phase 4)

HouseholdOS is the authoritative calendar. One domain model powers the website and installed PWA.

| Concern | Approach |
|---|---|
| Tables | `calendar_events`, `calendar_event_attendees`, `calendar_event_reminders`, `calendar_event_exceptions`, `calendar_event_exception_attendees`, `calendar_event_exception_reminders`, `calendar_event_occurrences`, `calendar_feed_tokens` |
| Visibility | `household` \| `participants` \| `private_busy` — enforced in RLS + query projection (busy blocks strip title/location/notes/guests/reminders/attendees) |
| Time | Timed (`timestamptz` + IANA TZ) XOR all-day (`date` + exclusive end). Household default `America/Chicago`. |
| Recurrence | RFC 5545 RRULE on the master; exception/override rows (including **metadata-only** guest/reminder/attendee overrides); bounded occurrence materialization (~90 days past / ~180 future) via `reconcile_calendar_event_occurrences` |
| Lifecycle | `scheduled` → `cancelled` through RPCs only; direct status updates blocked |
| Reminders | Reminder offsets on the master (or per-occurrence override); schedules fan out per materialized occurrence into `scheduled_notification_requests` |
| Feeds | Per-user hashed bearer token; scopes `visible_to_me` / `household_public_only`; `GET /api/calendar/feed/[token]` returns `text/calendar` with `Cache-Control: private, no-store`. Read-only; no provider OAuth. Raw tokens never logged. |
| Worker health | Coordinators see aggregate delivery/horizon health under Settings → Operations (no secrets or payloads). |
| Nav | Primary: Home · Calendar · Chores · Money. Settings and Inbox under sidebar/`more`. |

External Apple/Google/LifeOS clients may **subscribe** to the personal feed. Changes in those apps do **not** write back to HouseholdOS. Refresh timing is controlled by the client.

## Chores and responsibilities (Phase 5)

| Concern | Approach |
|---|---|
| Definitions | `chore_definitions` — one-time or recurring reusable work |
| Occurrences | `chore_occurrences` — dated instances with lifecycle status |
| Assignments | `chore_assignments` — one/many/claimable; cross-household IDs rejected |
| Rotations | `chore_rotations` + `chore_rotation_members` — fixed, round_robin, balanced, manual_sequence (deterministic) |
| Completions | Append-oriented `chore_completion_records`; optional verification; photo evidence deferred |
| Responsibilities | `responsibility_areas` + assignments + explicit transfer workflow |
| Calendar | Optional `show_on_calendar`; `calendar_events.source_type = 'chore'`; chore owns reminders |
| Reminders | `scheduled_notification_requests` with `source_type = 'chore_occurrence'` |
| Auth | Lifecycle via SECURITY DEFINER RPCs; financial_coordinator has no chore override power |

## House resources (Phase 6)

Four separate domains share locations and expense-item links but are **not** one polymorphic item table.

| Concern | Implementation |
|---|---|
| Locations | `household_locations` — household-scoped, rename-safe, archived when referenced |
| Durable inventory | `inventory_items` + `inventory_condition_events` + `inventory_ownership_members` |
| Consumable supplies | `supply_items` + append-oriented `supply_stock_events`; restock policy `manual\|suggest\|automatic` (default suggest) |
| Pantry | `pantry_items` + `pantry_stock_events`; personal `owner_only` rows hidden via RLS (coordinators do not bypass); optional `is_staple` |
| Shopping | `shopping_lists` + `shopping_list_items`; default list lazy-created; active supply-request dedupe; meal-linked shortfall columns |
| Expense linkage | `resource_expense_links` → `expense_items` (not receipt OCR); void/amend does not delete physical items |
| Ownership | `household\|personal\|shared_selected\|temporary\|unknown` — distinct from payer/restocker |
| Visibility | `household\|owner_only\|selected_members` enforced in RLS |
| Quantity | `numeric(12,3)` + unit enum; no cross-unit conversion |
| Reminders | `scheduled_notification_requests` source types `pantry_item` / `inventory_item` |
| Nav | House enabled under `surface: "more"`; hub tabs for Inventory / Supplies / Pantry / Shopping / Meals / Recipes / Meal prep |
| Auth | RPCs with `householdos.resource_mutation`; financial_coordinator has no physical override |

## Meals and recipes (Phase 6.5)

Coordination-first meal planning on top of pantry, shopping, calendar, chores, and notifications. No portion claiming, leftover reservation, nutrition tracking, or AI recipe generation.

| Concern | Implementation |
|---|---|
| Recipes | `recipes` + ingredients/steps/equipment; visibility `household\|creator_only\|selected_members` (coordinators do not bypass creator-only) |
| Requests | `meal_requests` → deterministic `rank_recipe_candidates` → `accept_meal_request_result` creates a meal plan |
| Meal plans | Types `shared_household\|guest_inclusive\|personal\|open_household\|meal_prep`; attendance + guest headcount; serving estimates |
| Shopping prep | `meal_shopping_proposals`; policy `manual\|suggest_and_confirm\|automatic_on_acceptance` (default suggest_and_confirm); only after accept |
| Meal-prep batches | Approximate remaining states; no portion ownership columns |
| Calendar | Optional `source_type=meal_plan`; category includes `meal_prep` |
| Auth | RPCs with `householdos.meal_mutation`; actor from `auth.uid()` |

## Secure recipe URL import (Phase 6.6)

Recipe URL import is an authenticated, user-directed workflow, not a crawler.
Server Actions validate active membership and `meal.create`, then a bounded
server-only fetcher resolves DNS, rejects private/reserved destinations, pins
the connection to the validated public address, and revalidates every redirect.
It fetches one HTML page with no cookies or forwarded application headers.

Extraction is standards-first: JSON-LD Recipe, limited recipe Microdata/RDFa,
then a conservative HTML fallback. Results are stored in creator-only
`recipe_import_drafts` for 24 hours. Raw HTML is parsed in memory and is never
stored in the database, audit log, or client payload. The creator reviews and
edits the draft before `save_imported_recipe` writes through the existing
recipe lifecycle. Saved imports therefore use the same visibility, pantry
matching, scaling, ranking, meal-plan, and shopping-preparation rules as manual
recipes. Import alone never changes a shopping list.

Source attribution remains on `recipes`; source images are references only and
are not mirrored. Source refresh is manual and review-first. There is no
scheduled refresh, site-wide discovery, bulk import, paywall bypass, or
anti-bot evasion.

## Roadmap

```text
Phase 3 — Payment settlement ledger + payment-related in-app notifications
Phase 3.1 — Notification delivery: web push, preferences, quiet hours, digests, retries
Phase 4 — Shared HouseholdOS calendar, recurrence, reminders, secure iCalendar feed
Phase 5 — Chores / responsibility rotations on calendar + notifications
Phase 6 — Inventory, supplies, shopping lists, pantry
Phase 6.5 — Recipes, meal requests, meal planning, meal-prep batches
Phase 6.6 — Secure recipe URL import and review
Phase 7 — Preference-aware recipe recommendations + maintenance / repair coordination
Phase 8 — Household agreements, policies, approvals, acknowledgments, move-in/out, document retention (current)
Phase 9 — Broader household records / landlord portals / advanced analytics (future)
Later — LifeOS connector; optional Google/Apple calendar sync
```

Calendar stages remaining: LifeOS connector → optional two-way provider sync.

## Phase 7A — Preference-aware recommendations

Deterministic, versioned scoring (`SCORING_VERSION = "1"`) ranks visible recipes for a meal request using pantry coverage, use-soon utilization, attendee-scoped preferences, time, equipment, serving scalability, meal-prep/guest fit, and repetition penalties. Modes adjust weights only (`best_overall`, `use_what_we_have`, `use_food_soon`, `household_favorite`, `fastest`, `fewest_missing_items`, `meal_prep_friendly`, `guest_friendly`, `something_different`).

Personal ratings stay owner-private; organizers see anonymized explanations. Accepted plans are not auto-replaced when inputs change. Optional post-meal feedback is dismissible.

Key tables: `recipe_recommendation_runs`, `recipe_recommendation_results`, `recipe_recommendation_score_components`, `recipe_feedback_requests`, `recipe_feedback_responses`, `meal_request_attendees`, `recipe_prep_history`.

## Phase 7B — Maintenance

Separate domain (never mixed into meal/recipe tables): requests, assignments, append-only events, actions, chore/calendar/expense/inventory links, vendors, quotes, warranty claims, and private evidence (`maintenance-evidence` bucket; JPEG/PNG/WebP/PDF; signed URLs only).

Lifecycle is RPC-enforced. Emergency guidance is deterministic and never claims emergency services were contacted. `financial_coordinator` does not receive `maintenance.coordinator_override`.

## Phase 8 — Governance

Separate domain under `src/lib/governance/` and `/app/[householdId]/governance`: versioned household agreements/policies, section editor, proposal/approval/acknowledgment workflows, move-in/out transition checklists, private transition fields, and `governance-attachments` storage.

Writes are RPC-only (`householdos.governance_mutation`). Approved/active versions are immutable. Coordinator override never fabricates individual approvals. Financial coordinator approval is limited to financial documents. Membership is never removed merely by creating a move-out workflow.

## Out of scope (current)

Receipt OCR, actual bank/Venmo/Zelle/Plaid transfers, Google/Apple OAuth calendar sync, two-way calendar writeback, full offline sync, SMS, live email delivery (adapter boundary only until a provider is configured), chore photo evidence storage, public chore rankings or financial penalties for missed chores, barcode scanning, grocery delivery APIs, recipe-site crawling/indexing, paywall or anti-bot bypass, AI-generated recipes, portion claiming, automatic emergency-service contact, automatic landlord/vendor messaging.
