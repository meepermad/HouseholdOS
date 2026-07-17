/** Actions that must never enter the offline outbox. */

export const ONLINE_ONLY_ACTIONS = new Set([
  "confirmExpense",
  "voidExpense",
  "submitPayment",
  "confirmPayment",
  "rejectPayment",
  "reversePayment",
  "createWaiver",
  "reverseWaiver",
  "openDispute",
  "resolveDispute",
  "proposeRoutedSettlement",
  "approveRoutedSettlement",
  "acceptRoutedSettlement",
  "submitRoutedPayment",
  "confirmRoutedSettlement",
  "createOpeningBalance",
  "respondOpeningBalance",
  "confirmReceiptAsExpense",
  "exportHousehold",
  "restoreArchive",
  "governanceApprove",
  "governancePublish",
]);

export const OFFLINE_ALLOWED_ACTIONS = new Set([
  "addComment",
  "createShoppingItem",
  "markShoppingPurchased",
  "createPantryNote",
  "createChoreCompletionDraft",
]);

export function isOnlineOnlyAction(action: string): boolean {
  return ONLINE_ONLY_ACTIONS.has(action);
}

export function assertOfflineAllowed(action: string): void {
  if (isOnlineOnlyAction(action)) {
    throw new Error(
      `${action} requires an online connection and cannot be queued offline.`,
    );
  }
  if (!OFFLINE_ALLOWED_ACTIONS.has(action)) {
    throw new Error(`${action} is not on the offline allowlist.`);
  }
}
