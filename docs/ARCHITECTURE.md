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

- Mobile: compact sticky `AppHeader` (household name opens switcher; Account opens sheet) plus fixed bottom nav with notch/home-indicator safe areas (`viewport-fit=cover`, `shell-top`, `app-main-pad`, `safe-pb`)
- Floating quick-add (`+`) deep-links into existing create routes; More sheet groups Household / Communication / Account
- Desktop (`lg+`): sidebar navigation + wider content (capped ~`max-w-5xl`)
- Nav config lives in `src/lib/nav-items.ts`:
  - Bottom bar shows only enabled `surface: "primary"` items (capped at 4) so new domains do not crowd the thumb bar
  - Sidebar lists all enabled items (primary + `more`)
  - Primary: Home · Calendar · Chores · Money. House, Maintenance, Governance, Inbox, Settings, and Profile live under `more`
  - Lucide icons only; badges (chores due, money confirmations, urgent maintenance, inbox unread) hide when zero
  - Unshipped domains stay `enabled: false`
- Home is the household action center (attention, today, money summary, exceptions, quick actions); setup/members live under Settings
- Presentation maps in `src/lib/presentation/` humanize roles, audit events, and enums
- Roommate coordination (UX-B/C): guest notices, away status, chore coverage, weekly review, polls, utilities, emergency card, and RLS-scoped global search under `/app/[householdId]/…`
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

### Money overview projection

The Money hub loads a versioned RLS-scoped projection (`src/lib/money/overview.ts`, `MONEY_OVERVIEW_VERSION`) that aggregates:

- Official vs pending member balances
- Context-aware primary actions (max two)
- Financial attention queue (plain language, deep links)
- Compact pairwise balances + optional routed-settlement teaser
- Monthly financial summary (`MONTHLY_FINANCE_AGG_VERSION`) shared with Monthly Household Review
- Mixed recent activity (no raw audit keys)

Expense and payment list pages support thin URL filters for deep links from the overview. No privileged client is used for normal Money reads. Saved financial defaults and cross-record financial search are deferred.

### Monthly Household Review

Lifecycle entity `household_meetings` (draft → preparing → ready_for_review → locked → in_progress → completed → published → archived / cancelled) with section configuration, suggested agenda items, locked shared snapshots, personal addenda, session notes, decisions, and action items.

- Packet generation is RLS-scoped TypeScript (`src/lib/meetings/packet.ts`) reusing monthly finance aggregation.
- Suggested agenda rules are versioned (`AGENDA_RULES_VERSION`) in `src/lib/meetings/agenda-rules.ts`.
- Mutations go through security-definer RPCs (`ensure_monthly_meeting`, `lock_meeting_packet`, `start_meeting`, …) with `auth.uid()` actor checks.
- Shared packets stay household-safe; pairwise balances stay in personal addenda unless household policy allows sharing.
- Surface: `/app/[householdId]/meetings` under More / Ops (not a bottom-nav tab). In-app notifications and PWA push only.
- Food section includes compact shopping patterns (repeatedly low supplies, incomplete trip items, meals still missing ingredients) — not every shopping line.

### Shopping Intelligence and Forgotten Favorites

Deterministic, review-first shopping recommendations and occasional recipe rediscovery. No GPS, retailer checkout, or automatic purchasing.

| Concern | Approach |
|---|---|
| Candidate gather | Versioned TypeScript engine (`src/lib/shopping/recommendations/`) from meals, open requests, supplies/forecasts, recurring staples, guest/meal-prep needs, trip `still_needed`, and household-visible sources only |
| Forecast | Deterministic formula v1 (`src/lib/shopping/forecast.ts`) from supply stock events; approximate language; threshold recommendations remain when confidence is insufficient |
| Staples | Household restock history (`src/lib/shopping/staples.ts`) with min purchase count + per-item suppressions |
| Forgotten Favorite ingredients | Review-first proposal (`prepareRediscoveryIngredients` → `confirm_rediscovery_ingredient_proposal`); recalculates pantry/list; never auto-adds from suggestion snapshot |
| Workflow | Gather → dedupe → quantity suggest → explain → user review → add via existing shopping RPCs |
| Persistence | `shopping_recommendation_*`, trip sessions/events, rediscovery suggestions/proposals/links |
| Surfaces | `/house/shopping/recommendations`, `/house/shopping/[listId]/trip`, `/house/recipes/rediscover`, `/house/recipes/rediscover/[suggestionId]/ingredients`, `/settings/shopping` |

Personal pantry and creator-only recipes must not appear in shared recommendation explanations or counts. Multi-household surfaces show the household name.

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
| Feeds | Per-user hashed bearer token; scopes `visible_to_me` / `household_public_only`; optional Phase 9 `purpose` (`personal_ics` \| `lifeos` \| `export`) + calendar scope; `GET /api/calendar/feed/[token]` returns `text/calendar` with `Cache-Control: private, no-store`. Raw tokens never logged. |
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
Phase 8 — Household agreements, policies, approvals, acknowledgments, move-in/out, document retention
Phase 9 — Calendar expansion: availability, conflicts, resources, domain aggregation, ICS import/export, LifeOS read contract, Google OAuth sync architecture (current)
Later — Broader household records / landlord portals / advanced analytics; deeper provider sync maturity
```

Phase 4 calendar tables/RPCs/ICS feeds remain the source of truth. Phase 9 extends them additively (no rename-for-rename).

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

## Phase 9 — Calendar expansion

Extends Phase 4 without replacing working calendar models:

| Concern | Approach |
|---|---|
| Calendars | `household_calendars` + memberships (household / personal / subgroup / domain / external); events gain `calendar_id` |
| RSVP | Material-change reconfirmation (`needs_reconfirmation`); invitations inbox |
| Recurrence | This / this-and-future / entire series (`split_calendar_event_series`) |
| Availability | Rules + overrides + deterministic finder (suggestions never auto-create) |
| Conflicts | Soft warnings + hard exclusive-resource blocks |
| Resources | Optional bookable `calendar_resources` (not inventory ownership) |
| Domain aggregation | `source_type` projections + deep links; edits route to owning domain |
| ICS | Existing subscribe feeds + download export + import preview/confirm |
| LifeOS | Versioned read-only scoped feed contract (`docs/CALENDAR_LIFEOS.md`) |
| Google | OAuth + encrypted refresh tokens + sync mappings; two-way opt-in for native events; mock-verified unless live credentials exist |
| Attachments | Private `calendar-attachments` bucket; signed URLs only |

## Launch phase — setup, receipts, import/export, comments

| Concern | Approach |
|---|---|
| Setup wizard | Optional `household_setup_progress`; skippable steps; Home reminder until dismissed/completed; starter templates call existing RPCs |
| Receipts | Private `expense-receipts` bucket; review-first OCR via `ReceiptExtractionAdapter` (`local_tesseract` / `openai` / `fixture` / `disabled`); default on-device Tesseract.js + deterministic parser; draft expense only after confirm; integer cents; household-scoped merchant/item aliases |
| Receipt authorization | `can_view_expense_receipt` / `can_edit_expense_receipt` — uploader, financial coordinator, or linked-expense creator/payer/allocation participant. Unrelated active members cannot see drafts, OCR payloads, line classifications, or signed URLs |
| Duplicates | Advisory file/content/merchant-date-total signals — never silent merge |
| Resource links | Optional pantry/supply/inventory/shopping suggestions after review; void/amend does not delete physical resources |
| CSV import | Review-first batches; same-household RPCs; chores/calendar execute via domain RPCs; opening-balance rows stay drafts until both parties confirm |
| Opening balances | Pre-HouseholdOS debts via `opening_balance_entries`; both debtor and creditor must confirm (coordinator cannot bypass); confirmed entries create `obligation_kind = opening_balance` with null `expense_id`. Schema status `reversed` is reserved — opening-balance reverse RPC/UI are not implemented. |
| Routed settlements | One-intermediary A→B→C proposals under Money → Simplify balances; **only the payer** may create a binding proposal; idempotency keyed by household + actor; external A→C payment only; confirm atomically reduces both legs; reservations + stale revalidation. Confirmed-route correction requires participant review, recipient confirmation that money was returned, linked `payment_reversals` row, then atomic obligation restore. Unilateral `reverse_routed_settlement` is disabled. |
| Receipt destinations | After confirm, `apply_receipt_line_destinations` applies pantry/supply/inventory/shopping actions (`proposed→applied|failed|skipped|reversed`); reverse is soft and does not delete stock |
| Archive restore | Coordinator selective nonfinancial restore from export JSON into a household; financial/auth/secrets excluded |
| Offline sync | IndexedDB snapshots + mutation outbox; allowlist is empty until domain apply handlers exist; drain requires `applied: true` (ack-only → `unsupported`, recoverable); money confirms/routes/export/restore stay online-only; `SYNC_WORKER_SECRET` gates `/api/internal/sync/process`; logout clears offline data |
| Roommate ops | Shared purchases, meeting board, packages, directory, supply forecast, optional parking module, retention policy row |
| Products | Browser one-shot barcode + manual digits; `ProductLookupAdapter` (fixture/manual); review required |
| Calendar interop | Google PKCE + mock/live provider gate; Apple ICS subscribe/export/import only |
| Export | Coordinator async JSON/CSV archive via `EXPORT_WORKER_SECRET` worker; excludes secrets, push endpoints, feed tokens; not a full database restore |
| Document jobs | Receipt OCR claim/complete via `DOCUMENT_JOB_WORKER_SECRET` at `/api/internal/documents/process` |
| Notifications worker | `/api/internal/notifications/dispatch` uses `NOTIFICATION_WORKER_SECRET` only |
| Comments | Polymorphic `record_comments`; `can_view_comment_parent` + `can_comment_on_parent` required (membership alone is insufficient); append-oriented; cannot change financial/governance state |
| Feature readiness | Launch routes probe for required tables; hide controls and show coordinator-facing setup state when objects are missing |
| Receipt retention | Soft-delete (`deleted_at`); removed members lose access; do not put receipt content in notification payloads |

## Out of scope (current)

Actual bank/Venmo/Zelle/Plaid transfers, SMS, live email delivery (adapter boundary only until a provider is configured), chore photo evidence storage, public chore rankings or financial penalties for missed chores, barcode scanning, grocery delivery APIs, recipe-site crawling/indexing, paywall or anti-bot bypass, AI-generated recipes, portion claiming, automatic emergency-service contact, automatic landlord/vendor messaging, Apple Calendar two-way writeback, claiming live Google/Apple verification without credentials, automatic opening-balance CSV confirm (imports stay drafts), full raw database restore from export (selective nonfinancial restore only), offline financial mutation queues.
