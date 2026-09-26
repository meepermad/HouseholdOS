import { formatMoney } from "@/lib/expenses/display";

export type PaymentNarrativeInput = {
  status: string;
  amountCents: number;
  senderName: string;
  recipientName: string;
  senderMembershipId: string;
  recipientMembershipId: string;
  createdByMembershipId: string;
};

/** One sentence for what actually happened. No second acknowledgment is invented. */
export function describePaymentRecord(input: PaymentNarrativeInput): string {
  const amount = formatMoney(input.amountCents);
  const senderRecorded = input.createdByMembershipId === input.senderMembershipId;
  if (input.status === "submitted" && senderRecorded) {
    return `${input.senderName} reported sending ${amount}.`;
  }
  if (input.status === "submitted") {
    return `${input.recipientName} started a payment record for ${amount}.`;
  }
  if (input.status === "confirmed" && senderRecorded) {
    return `${input.recipientName} acknowledged receiving ${amount}.`;
  }
  if (input.status === "confirmed") {
    return `${input.recipientName} recorded receiving ${amount} from ${input.senderName}.`;
  }
  if (input.status === "rejected") {
    return `${input.recipientName} said the ${amount} payment was not received.`;
  }
  if (input.status === "cancelled") {
    return `${input.senderName} cancelled the report of sending ${amount}.`;
  }
  if (input.status === "reversed") {
    return `Payment corrected. The ${amount} record was reversed and kept in the history.`;
  }
  return `${input.senderName} and ${input.recipientName} have a ${amount} payment record.`;
}

export function paymentStatusLabel(input: {
  status: string;
  createdByMembershipId?: string | null;
  senderMembershipId?: string | null;
}): string {
  if (input.status === "submitted") return "Payment reported as sent";
  if (input.status === "confirmed") {
    if (
      input.createdByMembershipId &&
      input.senderMembershipId &&
      input.createdByMembershipId !== input.senderMembershipId
    ) {
      return "Payment received";
    }
    return "Payment received";
  }
  if (input.status === "rejected") return "Payment not received";
  if (input.status === "cancelled") return "Payment cancelled";
  if (input.status === "reversed") return "Payment corrected";
  if (input.status === "partially_settled") return "Partially paid";
  if (input.status === "settled") return "Fully settled";
  return "Payment record";
}
