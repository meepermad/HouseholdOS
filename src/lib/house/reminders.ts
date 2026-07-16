/**
 * Reminder idempotency helpers for inventory/pantry/shopping schedules.
 * Actual writes go through scheduled_notification_requests RPCs.
 */

export function pantryUseSoonIdempotencyKey(params: {
  pantryItemId: string;
  recipientUserId: string;
  date: string;
}): string {
  return `pantry_use_soon:${params.pantryItemId}:${params.recipientUserId}:${params.date}`;
}

export function pantryDatePassedIdempotencyKey(params: {
  pantryItemId: string;
  recipientUserId: string;
  date: string;
}): string {
  return `pantry_date_passed:${params.pantryItemId}:${params.recipientUserId}:${params.date}`;
}

export function inventoryWarrantyIdempotencyKey(params: {
  inventoryItemId: string;
  recipientUserId: string;
  date: string;
}): string {
  return `inventory_warranty:${params.inventoryItemId}:${params.recipientUserId}:${params.date}`;
}

export function inventoryLoanReturnIdempotencyKey(params: {
  inventoryItemId: string;
  recipientUserId: string;
  date: string;
}): string {
  return `inventory_loan_return:${params.inventoryItemId}:${params.recipientUserId}:${params.date}`;
}

export function shoppingNeededByIdempotencyKey(params: {
  shoppingItemId: string;
  recipientUserId: string;
  date: string;
}): string {
  return `shopping_needed_by:${params.shoppingItemId}:${params.recipientUserId}:${params.date}`;
}

export const RESOURCE_REMINDER_SOURCE_TYPES = [
  "pantry_item",
  "inventory_item",
  "shopping_list_item",
] as const;

export type ResourceReminderSourceType =
  (typeof RESOURCE_REMINDER_SOURCE_TYPES)[number];

/** Cancel future reminders when pantry is finished/discarded. */
export function shouldCancelPantryReminders(state: string): boolean {
  return state === "finished" || state === "discarded";
}

/** Removed members must not receive new personal reminders. */
export function filterActiveReminderRecipients(params: {
  candidateUserIds: readonly string[];
  activeUserIds: readonly string[];
}): string[] {
  const active = new Set(params.activeUserIds);
  return params.candidateUserIds.filter((id) => active.has(id));
}
