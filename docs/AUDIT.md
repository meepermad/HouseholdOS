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

## Event types (Phase 3 payments / settlement)

- `reimbursement.partially_settled`
- `reimbursement.settled`
- `reimbursement.reopened`
- `payment.created`
- `payment.submitted`
- `payment.confirmed`
- `payment.rejected`
- `payment.cancelled`
- `payment.reversed`
- `payment.allocation_created`
- `waiver.reversed`
- `dispute.opened`
- `dispute.resolved`
- `dispute.withdrawn`
- `refund_obligation.created`

## Event types (Phase 4 calendar)

- `calendar.event_created`
- `calendar.event_updated`
- `calendar.event_cancelled`
- `calendar.occurrence_updated`
- `calendar.occurrence_cancelled`
- `calendar.attendee_added`
- `calendar.attendee_removed`
- `calendar.rsvp_changed`
- `calendar.feed_created`
- `calendar.feed_revoked`
- `calendar.feed_regenerated`
- `calendar.coordinator_override`

Calendar audit payloads must not include raw feed tokens, private descriptions, guest notes, or sensitive locations.

## Event types (Phase 5 chores / responsibilities)

- `chore.definition_created`
- `chore.definition_updated`
- `chore.definition_paused`
- `chore.definition_resumed`
- `chore.definition_ended`
- `chore.occurrence_created`
- `chore.assigned`
- `chore.claimed`
- `chore.reassigned`
- `chore.started`
- `chore.completed`
- `chore.blocked`
- `chore.skipped`
- `chore.cancelled`
- `chore.awaiting_verification`
- `chore.verified`
- `chore.reopened`
- `chore.rotation_created`
- `chore.rotation_updated`
- `responsibility.created`
- `responsibility.assigned`
- `responsibility.transfer_requested`
- `responsibility.transfer_accepted`
- `responsibility.transfer_declined`
- `responsibility.ended`

Chore audit payloads must not include private evidence URLs, sensitive completion notes, or push subscription data.

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

## Notification delivery auditability (Phase 3.1)

Separate from `audit_events`:

- `notification_events` — durable outbox (routing payload only)
- `notification_deliveries` — channel attempts (`queued` → `claimed` → `sent` | `retry` | `dead_letter` | `expired`)
- Delivery `last_error` is sanitized; never store raw push endpoints or keys
- Dead-letter does not alter financial audit rows
- Retention: keep events as operational history; do not auto-delete unread inbox rows or audit events
