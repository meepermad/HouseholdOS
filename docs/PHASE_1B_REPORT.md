# Phase 1B report — linked deployment & security hardening

## 1. Linked project verification

- Project name: **HouseholdOS**
- Project ref: `bdndibbupvyihzfjmwkj`
- Region: us-east-2
- Status: ACTIVE_HEALTHY
- CLI: `linked: true` (`supabase/.temp/project-ref` matches)

## 2. Initial remote migration state

Before Phase 1B hardening work, remote already had foundation migrations applied (not empty history):

| Local | Remote |
|---|---|
| 20260714140000 | 20260714140000 |
| 20260714140100 | 20260714140100 |
| 20260714140200 | 20260714140200 |
| 20260714140300 | 20260714140300 |
| 20260714140400 | 20260714140400 |

Remote tables existed with **0 rows**; **0 Auth users**. Treated as safe empty development project (schema present, no real roommate data).

## 3. Dry-run result

Initial: `Remote database is up to date.` (foundation already applied).

After adding hardening migration (empty duplicate removed):

```text
Would push these migrations:
 • 20260714151000_harden_membership_audit_signup.sql
```

No unrelated drops/alters. No Phase 0 migrations.

## 4. Migration review findings

Foundation migrations were already sound on ordering/FKs/search_path for helpers and RPCs.

Identified and fixed gaps (in 1B migration):

- Broad `household_memberships` UPDATE policy allowed sensitive field changes via PostgREST
- `audit_events` INSERT policy allowed forgeable history
- App-layer invite policy alone cannot stop Auth signup with publishable key

## 5. Membership-policy changes

- Dropped `memberships_update_self_or_coordinator`
- Dropped authenticated `membership_roles` insert bootstrap policy (create path is SECURITY DEFINER)
- Added trigger `enforce_membership_immutable_identity` (blocks `household_id` / `user_id` / id changes)
- Status/role transitions remain via audited RPCs only

## 6. Audit-system changes

- Dropped `audit_insert_member`
- Added `write_audit_event` SECURITY DEFINER:
  - Forces `actor_user_id = auth.uid()`
  - Forces `created_at = now()`
  - Allowlists event types
  - Requires active membership when `household_id` set
  - Rejects secret-like JSON payloads
- App household/settings updates now call the RPC (no direct inserts)
- SELECT remains member-scoped; no UPDATE/DELETE policies

## 7. Invite-only Auth enforcement decision

**Implemented:** Postgres function `hook_before_user_created` + `auth_registration_policy` table.

**Allows:** open mode; bootstrap email; pending unexpired invitation (does not consume); `@hos-itest.local` when `allow_test_emails=true`.

**Does not trust** client metadata for invitation proof.

**Dashboard activation required** (documented). Until enabled: residual risk of uninvited Auth accounts; **household data remains RLS-protected** (integration-tested).

## 8. Migrations applied

Pushed successfully:

- `20260714151000_harden_membership_audit_signup.sql`

Foundation five were already remote; no `db reset --linked`.

## 9. Final remote migration list

All six timestamps present locally and remotely through `20260714151000`.

## 10. Tables / functions / policies / triggers verified

Tables OK via API: profiles, households, settings, memberships, roles, invitations, preferences, audit_events, auth_registration_policy.

Functions present (linked types + tests): create/accept/revoke/leave/remove/change roles, ensure_profile, set_current_household, write_audit_event, hook_before_user_created, is_active_member, has_responsibility.

Trigger added: membership immutable identity.

## 11. Linked database lint

`npx supabase db lint --linked --level error` → **No schema errors found**.

## 12. Generated database types

- File: `src/types/database.generated.ts` (from `--linked`)
- Contains hardening objects; no secrets detected
- Excluded from `tsc` / ESLint (hand-maintained `src/types/database.ts` remains runtime typing source)
- Scripts: `npm run db:types` (linked), `npm run db:types:local`

## 13. Supabase Auth settings verified

- Site URL / redirect allowlist: **documented, not Dashboard-verified in this session**
- Before User Created hook: **function deployed; Dashboard toggle still manual**
- Email confirmation / rate limits: **not verified**

## 14. Integration tests executed

Linked RLS/security suite against hosted project: **passed** (45 tests total including units/components + linked integration).

Covered: cross-household deny, no direct membership mutate, no self-promote, invite authority, wrong/expired/revoked/replay invites, removed loses access, audit forge/edit/delete deny, hook allow/deny, ensure_profile idempotent.

Cleanup: afterAll deletes run-scoped households/users only.

## 15. End-to-end tests executed

Playwright smoke remains env/browser gated; full email-confirmation matrix is manual (see checklist below). Automated `npm test` includes auth form component coverage.

**Manual checklist (email-dependent):** confirm email → login → forgot/reset → callback invalid/expired → invite accept/decline in browser.

## 16. Temporary test-data cleanup result

Integration `afterAll` ran without leaving the failure path; subsequent table counts expected zero for run-scoped rows. Privileged delete targeted only `@hos-itest.local` users created in that run.

## 17. Commands and results

| Command | Result |
|---|---|
| `migration list --linked` | 6/6 matched |
| `db push --dry-run` | Only 151000 hardening |
| `db push` | Applied 151000 |
| `db lint --linked --level error` | Clean |
| `gen types --linked` | Wrote generated file |
| `npm test` (with .env.local) | 45 passed |
| `npm run typecheck` | Pass (after excluding polluted intermediate generated file) |
| `npm run lint` | Pass |
| `npm run build` | Re-run after type fix |

## 18. Security findings

Resolved:

- Direct membership UPDATE bypass
- Arbitrary audit inserts
- Source-controlled signup hook function

Open / residual:

- Hook must be enabled in Dashboard before Auth-level invite enforcement is live
- Auth Site URL / redirects not Dashboard-verified here
- `allow_test_emails=true` on linked dev policy — set `false` (or tighten domain) before real roommate use
- Built-in Supabase email provider limits remain

## 19. Remaining manual configuration

1. Enable Before User Created hook → `public.hook_before_user_created`
2. Confirm Site URL + redirect allowlist
3. Set `auth_registration_policy.bootstrap_email` / mode as needed; disable test emails for roommate launch
4. Decide email confirmation on/off intentionally

## 20. Known limitations

- Docker still unavailable locally
- Dashboard Auth settings not live-verified from CLI
- Playwright full multi-user UI path not expanded in this phase
- Generated types are reference; hand types still authoritative for the app

## 21. Ready for real roommate accounts?

**Not yet — almost.** Schema, RLS hardening, and linked integration tests are green on an empty project. Before roommate accounts:

1. Activate the Auth hook in Dashboard
2. Verify redirect URLs
3. Disable integration-test signup domain (`allow_test_emails=false`)
4. Set bootstrap/invite policy intentionally
5. Smoke-test signup → create household → invite → accept in the browser

## 22. Exact recommendation for beginning Phase 2

After the Dashboard hook + Auth URL checklist above: begin **Phase 2 — manual itemized-expense and reimbursement-calculation engine** (allocations, personal exclusions, obligations, confirmation, financial audit trails). Do not start Phase 2 while the Before User Created hook remains disabled if Auth-level invite gating is required.
