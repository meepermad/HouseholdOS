import {
  EVENT_DISPUTE_OPENED,
  EVENT_DISPUTE_RESOLVED,
  EVENT_EXPENSE_AMENDED,
  EVENT_EXPENSE_VOIDED,
  EVENT_PAYMENT_AWAITING_CONFIRMATION,
  EVENT_PAYMENT_CANCELLED,
  EVENT_PAYMENT_CONFIRMED,
  EVENT_PAYMENT_REJECTED,
  EVENT_PAYMENT_REVERSED,
  EVENT_REFUND_OBLIGATION_CREATED,
  EVENT_WAIVER_CREATED,
  EVENT_WAIVER_REVERSED,
  getCatalogEntry,
  type RecipientRule,
} from "@/lib/notifications/catalog";

/**
 * Recipient rules mirror Phase 3 `_emit_notification_event` fan-out:
 *
 * - payment.awaiting_confirmation → payment recipient user
 * - payment.confirmed / rejected → payment sender user
 * - payment.cancelled → payment recipient user
 * - payment.reversed → other party (sender when recipient reverses)
 * - waiver.created / waiver.reversed → obligation debtor user
 * - dispute.opened → all other active household members (actor excluded)
 * - dispute.resolved → dispute raiser user
 * - refund_obligation.created → original debtor (now refund creditor)
 * - expense.voided / expense.amended → other active members (actor excluded)
 */

export type RecipientRuleExpectation = {
  eventType: string;
  rule: RecipientRule;
  description: string;
};

const RULE_DESCRIPTIONS: Record<RecipientRule, string> = {
  payment_recipient: "Payment recipient membership user",
  payment_sender: "Payment sender membership user",
  other_party: "Counterparty on the payment (non-actor)",
  debtor: "Obligation debtor membership user",
  involved_parties: "Users tied to the subject entity",
  other_active_members: "Active household members excluding the actor",
  raiser: "Membership that raised the dispute / request",
  actor_excluded: "Recipients resolved elsewhere with actor omitted",
  self: "Acting user only",
  explicit: "Caller-supplied recipient user ids",
};

export function describeRecipientRule(eventType: string): string {
  const entry = getCatalogEntry(eventType);
  if (!entry) return `Unknown event type: ${eventType}`;
  return RULE_DESCRIPTIONS[entry.recipientRule];
}

/** Expected Phase 3 active-event recipient rules for unit tests. */
export const PHASE3_RECIPIENT_RULES: readonly RecipientRuleExpectation[] = [
  {
    eventType: EVENT_PAYMENT_AWAITING_CONFIRMATION,
    rule: "payment_recipient",
    description: RULE_DESCRIPTIONS.payment_recipient,
  },
  {
    eventType: EVENT_PAYMENT_CONFIRMED,
    rule: "payment_sender",
    description: RULE_DESCRIPTIONS.payment_sender,
  },
  {
    eventType: EVENT_PAYMENT_REJECTED,
    rule: "payment_sender",
    description: RULE_DESCRIPTIONS.payment_sender,
  },
  {
    eventType: EVENT_PAYMENT_CANCELLED,
    rule: "payment_recipient",
    description: RULE_DESCRIPTIONS.payment_recipient,
  },
  {
    eventType: EVENT_PAYMENT_REVERSED,
    rule: "other_party",
    description: RULE_DESCRIPTIONS.other_party,
  },
  {
    eventType: EVENT_WAIVER_CREATED,
    rule: "debtor",
    description: RULE_DESCRIPTIONS.debtor,
  },
  {
    eventType: EVENT_WAIVER_REVERSED,
    rule: "debtor",
    description: RULE_DESCRIPTIONS.debtor,
  },
  {
    eventType: EVENT_DISPUTE_OPENED,
    rule: "other_active_members",
    description: RULE_DESCRIPTIONS.other_active_members,
  },
  {
    eventType: EVENT_DISPUTE_RESOLVED,
    rule: "raiser",
    description: RULE_DESCRIPTIONS.raiser,
  },
  {
    eventType: EVENT_REFUND_OBLIGATION_CREATED,
    rule: "debtor",
    description: RULE_DESCRIPTIONS.debtor,
  },
  {
    eventType: EVENT_EXPENSE_VOIDED,
    rule: "other_active_members",
    description: RULE_DESCRIPTIONS.other_active_members,
  },
  {
    eventType: EVENT_EXPENSE_AMENDED,
    rule: "other_active_members",
    description: RULE_DESCRIPTIONS.other_active_members,
  },
] as const;

export function expectedRecipientRule(
  eventType: string,
): RecipientRule | undefined {
  return PHASE3_RECIPIENT_RULES.find((r) => r.eventType === eventType)?.rule;
}
