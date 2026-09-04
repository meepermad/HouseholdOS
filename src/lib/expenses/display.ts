import { formatUsdFromCents, toCents } from "@/lib/money";
import { expenseStatusCopy, humanStatusLabel } from "@/lib/presentation/human-status";

export function formatMoney(cents: number): string {
  return formatUsdFromCents(toCents(cents));
}

export function statusLabel(status: string): string {
  return expenseStatusCopy(status).label || humanStatusLabel(status);
}

export type MemberOption = {
  id: string;
  label: string;
};

/** Plain-language names for item allocation modes. */
export function itemAllocationLabel(mode: string): string {
  switch (mode) {
    case "personal":
      return "Just one person";
    case "equal_all":
      return "Split equally between everyone";
    case "equal_selected":
      return "Split equally between some people";
    case "fixed_cents":
      return "Exact amount each";
    case "percentage":
      return "Percentage each";
    case "weighted":
      return "Shares each";
    case "excluded":
      return "Not split — no reimbursement";
    default:
      return mode;
  }
}

/** Plain-language names for adjustment allocation modes. */
export function adjustmentAllocationLabel(mode: string): string {
  switch (mode) {
    case "proportional":
      return "In proportion to each person's items";
    case "equal_all":
      return "Split equally between everyone";
    case "equal_selected":
      return "Split equally between some people";
    case "fixed_cents":
      return "Exact amount each";
    case "percentage":
      return "Percentage each";
    case "weighted":
      return "Shares each";
    case "payer_absorbs":
      return "The payer covers it";
    case "assigned":
      return "Charged to one person";
    default:
      return mode;
  }
}

export function adjustmentTypeLabel(type: string): string {
  switch (type) {
    case "tax":
      return "Tax";
    case "tip":
      return "Tip";
    case "delivery_fee":
      return "Delivery fee";
    case "service_fee":
      return "Service fee";
    case "discount":
      return "Discount";
    case "coupon":
      return "Coupon";
    case "store_credit":
      return "Store credit";
    case "other":
      return "Other";
    default:
      return type;
  }
}
