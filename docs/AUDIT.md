# Audit Event Strategy (Phase 0)

## Principles

- Append-only `audit_events` table: members may `INSERT`/`SELECT`; no `UPDATE`/`DELETE` policies
- Every meaningful household mutation should emit an audit row
- Prefer writing audit + domain mutation in one Postgres transaction (RPCs for create household, invite, accept invite)
- For leave/remove, audit is written **before** membership status changes so RLS still allows the insert
- Later phases: confirmed financial rows are never silently edited; corrections create amendments/reversals plus audit events
- Later phases: OCR produces drafts only; confirmation is an explicit audited transition

## Phase 0 actions

- `household.created`
- `household.updated`
- `household.archived`
- `member.invited`
- `member.joined`
- `member.role_changed`
- `member.removed`
- `member.left`
- `invite.revoked`
- `settings.updated`

## Payload shape

| Column | Purpose |
|---|---|
| `household_id` | Tenant scope |
| `actor_user_id` | Who performed the action |
| `entity_type` / `entity_id` | Subject of the change |
| `action` | Stable action string |
| `before_state` / `after_state` | Redacted JSON snapshots |
| `metadata` | Extra context (e.g. invitation id, transfer flag) |
| `created_at` | Immutable timestamp |

Helpers live in `src/lib/audit.ts`.
