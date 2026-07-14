import { formatUsdFromCents, toCents } from "@/lib/money";

export function formatMoney(cents: number): string {
  return formatUsdFromCents(toCents(cents));
}

export function statusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "ready_for_review":
      return "Ready for review";
    case "confirmed":
      return "Confirmed";
    case "amended":
      return "Amended";
    case "voided":
      return "Voided";
    default:
      return status;
  }
}

export type MemberOption = {
  id: string;
  label: string;
};
