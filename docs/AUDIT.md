# Audit events

## Principles

- Append-only `audit_events`
- Clients write via `write_audit_event` (allowlisted event types) or SECURITY DEFINER RPCs insert directly
- Actor is always derived from `auth.uid()` — never client-supplied
- No `UPDATE` / `DELETE` policies for ordinary roles
- Prefer writing audit inside transactional RPCs for financial mutations
- Never store passwords, raw invite tokens, secret keys, or credentials

## Event types (foundation)

- `household.created`
- `household.updated`
- `household.archived`
- `household.settings_updated`
- `invitation.created`
- `invitation.accepted`
- `invitation.declined`
- `invitation.revoked`
- `membership.status_changed`
- `membership.roles_changed`
- `profile.recovered`

## Event types (Phase 2 expenses)

- `expense.created`
- `expense.submitted_for_review`
- `expense.confirmed`
- `expense.amendment_created`
- `expense.amended`
- `expense.voided`
- `expense.draft_deleted`
- `reimbursement.created`
- `reimbursement.adjusted`
- `reimbursement.reversed`
- `reimbursement.waived`

## Shape

| Column | Purpose |
|---|---|
| `household_id` | Tenant scope |
| `actor_user_id` | Actor |
| `entity_type` / `entity_id` | Subject |
| `event_type` | Stable event name |
| `before_state` / `after_state` | Redacted JSON |
| `reason` | Optional |
| `correlation_id` | Group related writes |
| `created_at` | Immutable |

Helpers: `src/lib/audit.ts`, `buildAuditRow` in `src/lib/tokens.ts`.
