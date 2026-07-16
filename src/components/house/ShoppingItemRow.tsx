import { ActionForm } from "@/components/action-form";
import {
  cancelShoppingItemAction,
  claimShoppingItemAction,
  markShoppingItemPurchasedAction,
} from "@/app/actions/house";
import { SHOPPING_PRIORITY_LABELS } from "@/lib/house/display";
import { formatQuantityLabel } from "@/lib/house/quantity";
import type { ShoppingListItemView } from "@/lib/house/queries";
import { StatusBadge } from "./ConditionBadge";

const PRIORITY_TONES: Record<string, string> = {
  urgent: "border-destructive/40 bg-destructive/10 text-destructive",
  high: "border-warning/40 bg-warning-soft text-warning",
  low: "border-border-strong bg-surface-secondary text-text-muted",
};

const secondaryClass =
  "min-h-11 rounded-md border border-border px-3 text-sm font-semibold hover:bg-surface-interactive";

/** Large touch targets — meant to be tapped one-handed while pushing a cart. */
export function ShoppingItemRow({
  householdId,
  item,
  currentMembershipId,
}: {
  householdId: string;
  item: ShoppingListItemView;
  currentMembershipId: string;
}) {
  const purchased = item.status === "purchased";
  const closed = purchased || item.status === "cancelled" || item.status === "unavailable";
  const isMine = item.assignedShopperMembershipId === currentMembershipId;
  const hidden = (
    <>
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="itemId" value={item.id} />
    </>
  );

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3.5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className={`font-medium ${purchased ? "text-text-muted line-through" : "text-text-primary"}`}>
          {item.name}
        </p>
        <p className="mt-1 text-sm text-text-secondary">
          {formatQuantityLabel({ amount: item.quantity, unit: item.quantityUnit })}
          {item.assignedShopperLabel
            ? ` · ${isMine ? "Claimed by you" : `Claimed by ${item.assignedShopperLabel}`}`
            : ""}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {item.priority !== "normal" ? (
          <StatusBadge
            label={SHOPPING_PRIORITY_LABELS[item.priority]}
            tone={PRIORITY_TONES[item.priority]}
            testValue={item.priority}
          />
        ) : null}
        {closed ? (
          <StatusBadge
            label={purchased ? "Purchased" : item.status === "unavailable" ? "Unavailable" : "Cancelled"}
            tone={
              purchased
                ? "border-success/40 bg-success-soft text-success"
                : "border-border-strong bg-surface-secondary text-text-muted"
            }
            testValue={item.status}
          />
        ) : (
          <>
            {!item.assignedShopperMembershipId ? (
              <ActionForm action={claimShoppingItemAction} pendingLabel="Claiming…">
                {hidden}
                <button type="submit" className={secondaryClass}>
                  Claim
                </button>
              </ActionForm>
            ) : null}
            <ActionForm action={markShoppingItemPurchasedAction} pendingLabel="Marking…">
              {hidden}
              <button
                type="submit"
                className="min-h-11 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground"
              >
                Got it
              </button>
            </ActionForm>
            <ActionForm action={cancelShoppingItemAction} pendingLabel="Cancelling…">
              {hidden}
              <button type="submit" className="min-h-11 rounded-md px-3 text-sm text-text-muted hover:underline">
                Cancel
              </button>
            </ActionForm>
          </>
        )}
      </div>
    </li>
  );
}
