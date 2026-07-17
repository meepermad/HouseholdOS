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

## Event types (Phase 6 house resources)

- `inventory.item_created`
- `inventory.item_updated`
- `inventory.ownership_changed`
- `inventory.condition_changed`
- `inventory.location_changed`
- `inventory.item_disposed`
- `inventory.item_transferred`
- `supply.item_created`
- `supply.stock_updated`
- `supply.restocked`
- `pantry.item_created`
- `pantry.stock_updated`
- `pantry.discarded`
- `shopping.list_created`
- `shopping.item_requested`
- `shopping.item_updated`
- `shopping.item_assigned`
- `shopping.item_purchased`
- `shopping.item_cancelled`
- `resource.expense_linked`
- `resource.expense_unlinked`

House-resource audit and notification payloads must not include private purchase notes, personal pantry quantities/dietary notes, or receipt secrets. Domain RPCs insert via `_resource_audit` (actor from `auth.uid()`).

## Event types (Phase 6.5 meals)

- `recipe.created`
- `recipe.updated`
- `recipe.archived`
- `recipe.visibility_changed`
- `recipe.import_requested`
- `recipe.import_extracted`
- `recipe.import_failed`
- `recipe.import_saved`
- `recipe.import_cancelled`
- `recipe.source_refreshed`
- `meal.settings_updated`
- `meal.request_created`
- `meal.planned`
- `meal.rsvp_changed`
- `meal.cancelled`
- `meal.shopping_needed`
- `meal.preparing`
- `meal.prepared`
- `meal.pantry_usage_confirmed`
- `meal_batch.use_soon`
- `meal_batch.discarded`

Meal audit payloads must not include guest dietary notes, private pantry quantities, or medical dietary explanations. Domain RPCs insert via `_meal_audit` (actor from `auth.uid()`).

Recipe-import audit payloads contain only the source hostname, extraction
strategy, result category, and saved recipe ID where applicable. They must not
contain full source URLs, URL query parameters, raw HTML, ingredients,
instructions, cookies, headers, or private draft payloads.

## Event types (Phase 7A recommendations)

- `recipe.preference_set`
- `recipe.preference_cleared`
- `recipe.feedback_requested`
- `recipe.feedback_submitted`
- `recipe.feedback_dismissed`
- `meal.recommendation_run`
- `meal.recommendation_inputs_changed`

Preference/feedback audit payloads must not include preference signals, numeric ratings, private notes, or preference author identity.

## Event types (Phase 7B maintenance)

- `maintenance.reported`
- `maintenance.triaged`
- `maintenance.assigned`
- `maintenance.waiting_status_changed`
- `maintenance.comment_added`
- `maintenance.resolved`
- `maintenance.closed`
- `maintenance.reopened`
- `maintenance.cancelled`
- `maintenance.appointment_scheduled`
- `maintenance.evidence_added`
- `maintenance.expense_linked`

Maintenance audit payloads must not include raw storage paths, private evidence URLs, or private comment bodies beyond redacted flags.

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
