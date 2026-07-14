# Phase 2 final report — Itemized expenses and reimbursement engine

## 1. Repository state before Phase 2

Phase 1 / 1B complete on linked Supabase project HouseholdOS. Foundation migrations `20260714140000`–`20260714151000` applied. Auth, households, memberships, invitations, audit hardening, and generated types in place. No expense tables. Money nav stub disabled.

## 2. Financial architecture decisions

- Integer cents only; pure TypeScript calculation engine is authoritative at confirm time
- Confirmation RPC validates snapshot against stored line totals and writes obligations transactionally
- Categories are constrained text (no category table)
- Financial history uses existing `audit_events` (no separate `financial_events`)
- Draft policy: any active member creates; creator or payer edits/confirms; others see drafts at `ready_for_review`+
- Eligible allocatees: `status = 'active'` memberships only
- Currency must match `households.currency`
- Privileged/secret client never used for ordinary expense ops

## 3. Allocation and rounding algorithm

**Largest fractional remainder** with stable sort:

1. Compute exact rational share per participant
2. Assign `floor(exact)`
3. Distribute remaining cents by fractional remainder descending
4. Tie-break by membership UUID ascending

Documented in `src/lib/expenses/rounding.ts`. Proportional adjustments use each member’s pre-adjustment item subtotal (excluded lines count toward payer unless opted out).

## 4. Expense lifecycle

`draft` → `ready_for_review` → `confirmed` → (`amended` | `voided`)

Confirmed records are immutable except via void/amendment RPCs. Amendments create a successor draft linked by `supersedes_expense_id`.

## 5. Amendment and void strategy

- **Void:** reason required; pending obligations → `reversed` with `current_amount_cents = 0`; original retained
- **Amend:** clone to draft; on confirm, reverse original obligations, confirm successor, mark original `amended`

## 6. Files created

- `src/lib/expenses/*` (engine, load-bundle, display, queries, index)
- `src/lib/validations/expenses.ts`
- `src/app/actions/expenses.ts`
- `src/components/expenses/*`
- Money routes under `src/app/(protected)/app/[householdId]/money/**`
- Migrations `20260714160000`–`20260714160500`
- `tests/unit/expenses/*`, `tests/integration/expenses-rls.test.ts`, component + e2e expense tests
- `docs/PHASE_2_REPORT.md`

## 7. Files modified

- `src/components/household-nav.tsx` (Money enabled)
- `src/lib/permissions.ts`, `src/types/database.ts` (re-export generated)
- `src/lib/household-context.ts`, `src/app/actions/household.ts` (type sync)
- `docs/AUDIT.md`, `docs/PERMISSIONS.md`
- `vitest.config.ts` (load `.env.local`)
- Foundation RLS cleanup to delete expense rows
- `src/types/database.generated.ts` (regenerated)

## 8. Migrations added

1. `20260714160000_expense_schema.sql`
2. `20260714160100_expense_rls.sql`
3. `20260714160200_expense_rpcs.sql`
4. `20260714160300_expense_service_role_bypass.sql`
5. `20260714160400_expense_grants.sql`
6. `20260714160500_expense_select_rls_fix.sql`

## 9. Tables, constraints, functions, indexes

**Tables:** `expenses`, `expense_items`, `expense_item_allocations`, `expense_adjustments`, `expense_adjustment_allocations`, `reimbursement_obligations`, `expense_amendments`

**Key constraints:** no self-debt obligations; unique obligation per expense/debtor/creditor; household consistency triggers; confirmed/void status checks; currency match

**RPCs:** `confirm_expense`, `void_expense`, `create_expense_amendment`, `confirm_expense_amendment`, helpers `can_view_expense`, `can_edit_expense_draft`, `current_membership_id`, `can_confirm_or_void_expense`

## 10. RLS policies added

Select/insert/update/delete on draft expense graphs for creator/payer; broader select from review onward; obligations select-only for members; writes via RPC + triggers.

## 11. Routes and interfaces added

`/app/[householdId]/money`, `/expenses`, `/expenses/new`, `/expenses/[id]`, `/edit`, `/review`, `/balances`

## 12. Calculation tests

24+ scenarios in `tests/unit/expenses/calculate-expense.test.ts` (equal splits, remainder, personal, excluded, fixed/%/weighted, tax/tip/discount, mixed, reconciliation, currency, payer self-share).

## 13. RLS and integration tests

`tests/integration/expenses-rls.test.ts` — 13 cases including cross-household isolation, allocation/payer rejection, atomic confirm, idempotency, concurrency, void/amend, former-member denial.

## 14. Browser tests

`tests/e2e/expenses.spec.ts` — unauthenticated money redirect + landing smoke. Full multi-user browser matrix covered primarily by linked integration tests (Auth rate limits make dual-file browser fixtures fragile).

## 15. Migration dry-run result

Would push Phase 2 migrations `…60000`–`…60500` (dry-run confirmed before each push).

## 16. Migration deployment result

All six Phase 2 migrations applied to linked remote; `migration list --linked` shows local=remote for foundation + Phase 2.

## 17. Database lint result

`npx supabase db lint --linked --level error` — clean (`results: []`).

## 18. Generated type result

`npm run db:types` regenerated `src/types/database.generated.ts`; app `database.ts` re-exports generated Database and keeps domain unions.

## 19. Commands and outcomes

| Command | Result |
|---|---|
| Unit + expense RLS + components | Pass (80 tests in scoped run) |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass (0 errors) |
| `npm run build` | Pass (money routes present) |
| `npm run test:e2e` | Pass after Chromium install (smoke) |
| Foundation `rls.test.ts` when co-run with expense suite | Intermittent Auth rate-limit failures — re-run file alone if needed |
| `db push` / `migration list` / `db lint` | Pass |

## 20. Security findings

- Cross-household expense isolation enforced by RLS + membership triggers
- Clients cannot insert/update obligations or confirm by status update
- Audit allowlist extended; forgery of unknown event types rejected
- Service-role bypass of immutability triggers is intentional for cleanup only (`auth.uid() is null`)
- INSERT…RETURNING required SELECT policy reform (row-column USING) to avoid false RLS denials

## 21. Known limitations

- Payment settlement UI not in Phase 2 (statuses reserved)
- Playwright full multi-user confirm/amend browser matrix not fully automated (integration covers DB path)
- Auth sign-in rate limits can flake when both large integration files run back-to-back
- Quantity is a display label only; line `total_cents` is authoritative
- Draft collaborative simultaneous editing not supported

## 22. Manual testing checklist

1. Sign in as an active member → Money → New expense
2. Add shared + personal + roommate-personal items and tax
3. Verify reconciliation summary; continue to review; confirm
4. Sign in as another roommate → verify obligation + itemized breakdown
5. Attempt cross-household URL → unauthorized/not found
6. Create amendment with reason → confirm → original shows amended
7. Void a confirmed expense with reason → obligations reversed
8. Confirm balances page you-owe / you-are-owed / net

## 23. Safe for real household expense records?

**Yes, for manual entry within this household**, with the caveats that payments are not recorded yet and operators should still avoid using production Auth rate-limit-sensitive test cleanup against real data. Use amendment/void — never delete confirmed financial history from the app.

## 24. Exact recommended next phase

**Phase 3: payment recording, partial settlements, confirmation, disputes, and obligation reconciliation** (Venmo/Zelle recording as metadata only; no bank/Plaid/OCR yet).
