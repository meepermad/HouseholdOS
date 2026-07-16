-- Phase 6: house resource reminder source types and event documentation.
--
-- Reminder source_type values written to scheduled_notification_requests by
-- the Phase 6 RPCs (see 20260720010200_house_resources_rpcs.sql):
--
--   pantry_item     -> event_types: pantry.use_soon, pantry.date_passed
--   inventory_item  -> event_types: inventory.warranty, inventory.loan_return
--
-- Reminders are only scheduled for owner_only (personal) pantry/inventory
-- items to avoid household-wide reminder spam; household-visible items rely
-- on manual review instead of automated per-item reminders.
--
-- Immediate (non-scheduled) notification event types emitted via
-- _resource_notify / _emit_notification_event:
--
--   inventory.item_created, inventory.condition_changed
--   supply.low, supply.restocked
--   pantry.finished
--   shopping.item_requested, shopping.item_assigned, shopping.item_purchased
--
-- All notification payloads are kept privacy-safe: titles/bodies are generic
-- and never include personal item names, quantities, or notes.

-- Defensive re-grant in case the Phase 6 RPCs migration's service_role grants
-- were not yet applied in this environment.
grant execute on function
  public._reconcile_inventory_reminders(uuid),
  public._reconcile_pantry_reminders(uuid),
  public._cancel_resource_source_reminders(text, uuid)
to service_role;
