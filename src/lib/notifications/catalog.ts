/**
 * Domain-neutral notification event catalog.
 * Active eventType strings match Phase 3 SQL emitters exactly.
 */

export type NotificationCategory =
  | "payments"
  | "disputes"
  | "expenses"
  | "reimbursements"
  | "membership"
  | "chores"
  | "calendar"
  | "inventory"
  | "shopping"
  | "maintenance"
  | "approvals"
  | "agreements"
  | "system";

export type NotificationUrgency = "low" | "normal" | "high" | "urgent";
export type NotificationChannel = "in_app" | "push" | "email";
export type DeliveryMode = "immediate" | "daily_digest" | "off";
export type PrivacyClass = "routing_only" | "generic_ok" | "detailed_ok";
export type RecipientRule =
  | "payment_recipient"
  | "payment_sender"
  | "other_party"
  | "debtor"
  | "involved_parties"
  | "other_active_members"
  | "raiser"
  | "actor_excluded"
  | "self"
  | "explicit";

/** Categories exposed in preference / inbox filter UIs. */
export const PREFERENCE_CATEGORIES = [
  "payments",
  "disputes",
  "membership",
  "chores",
  "calendar",
  "system",
] as const satisfies readonly NotificationCategory[];

/** Broader inbox filter set (UI-only; still uses DB category values). */
export const INBOX_FILTER_CATEGORIES = [
  "payments",
  "disputes",
  "membership",
  "chores",
  "calendar",
  "maintenance",
  "system",
] as const satisfies readonly NotificationCategory[];

export type CatalogEntry = {
  eventType: string;
  category: NotificationCategory;
  defaultUrgency: NotificationUrgency;
  defaultChannels: NotificationChannel[];
  recipientRule: RecipientRule;
  deepLinkPattern: string;
  digestAllowed: boolean;
  actionOriented: boolean;
  privacy: PrivacyClass;
  active: boolean;
};

// --- Active Phase 3 event types (canonical SQL strings) ---

/** Canonical emit type for payment submit. Conceptual alias: payment.submitted */
export const EVENT_PAYMENT_AWAITING_CONFIRMATION =
  "payment.awaiting_confirmation" as const;
/** Conceptual alias for EVENT_PAYMENT_AWAITING_CONFIRMATION */
export const EVENT_PAYMENT_SUBMITTED = EVENT_PAYMENT_AWAITING_CONFIRMATION;

export const EVENT_PAYMENT_CONFIRMED = "payment.confirmed" as const;
export const EVENT_PAYMENT_REJECTED = "payment.rejected" as const;
export const EVENT_PAYMENT_CANCELLED = "payment.cancelled" as const;
export const EVENT_PAYMENT_REVERSED = "payment.reversed" as const;

/** Canonical notify type. Conceptual alias: reimbursement.waived */
export const EVENT_WAIVER_CREATED = "waiver.created" as const;
export const EVENT_REIMBURSEMENT_WAIVED = EVENT_WAIVER_CREATED;

/** Canonical notify type. Conceptual alias: reimbursement.waiver_reversed */
export const EVENT_WAIVER_REVERSED = "waiver.reversed" as const;
export const EVENT_REIMBURSEMENT_WAIVER_REVERSED = EVENT_WAIVER_REVERSED;

export const EVENT_DISPUTE_OPENED = "dispute.opened" as const;
export const EVENT_DISPUTE_RESOLVED = "dispute.resolved" as const;
export const EVENT_REFUND_OBLIGATION_CREATED =
  "refund_obligation.created" as const;
export const EVENT_EXPENSE_VOIDED = "expense.voided" as const;
export const EVENT_EXPENSE_AMENDED = "expense.amended" as const;

export const EVENT_SETTLEMENT_INTERMEDIARY_APPROVAL_REQUIRED =
  "settlement.intermediary_approval_required" as const;
export const EVENT_SETTLEMENT_RECIPIENT_ACCEPTANCE_REQUIRED =
  "settlement.recipient_acceptance_required" as const;
export const EVENT_SETTLEMENT_READY_TO_PAY = "settlement.ready_to_pay" as const;
export const EVENT_SETTLEMENT_PAYMENT_SUBMITTED =
  "settlement.payment_submitted" as const;
export const EVENT_SETTLEMENT_PAYMENT_CONFIRMED =
  "settlement.payment_confirmed" as const;
export const EVENT_SETTLEMENT_ROUTE_REVERSED =
  "settlement.route_reversed" as const;
export const EVENT_OPENING_BALANCE_CONFIRMATION_REQUIRED =
  "opening_balance.confirmation_required" as const;

// --- Future reserved (documented; not emitted) ---

export const EVENT_CHORE_ASSIGNED = "chore.assigned" as const;
export const EVENT_CHORE_DUE_SOON = "chore.due_soon" as const;
export const EVENT_CHORE_OVERDUE = "chore.overdue" as const;
export const EVENT_CHORE_COMPLETED = "chore.completed" as const;
export const EVENT_CHORE_REASSIGNED = "chore.reassigned" as const;
export const EVENT_CHORE_AWAITING_VERIFICATION = "chore.awaiting_verification" as const;
export const EVENT_CHORE_REMINDER = "chore.reminder" as const;
export const EVENT_CHORE_REASSIGNMENT_REQUESTED = "chore.reassignment_requested" as const;
export const EVENT_CHORE_ROTATION_CREATED = "chore.rotation_created" as const;
export const EVENT_CHORE_ROTATION_UPDATED = "chore.rotation_updated" as const;
export const EVENT_RESPONSIBILITY_TRANSFER_REQUESTED = "responsibility.transfer_requested" as const;
export const EVENT_RESPONSIBILITY_TRANSFER_ACCEPTED = "responsibility.transfer_accepted" as const;
export const EVENT_RESPONSIBILITY_TRANSFER_DECLINED = "responsibility.transfer_declined" as const;
/** @deprecated Prefer EVENT_CHORE_DUE_SOON */
export const EVENT_CHORE_DUE = EVENT_CHORE_DUE_SOON;
export const EVENT_CALENDAR_EVENT_CREATED = "calendar.event_created" as const;
export const EVENT_CALENDAR_EVENT_UPDATED = "calendar.event_updated" as const;
export const EVENT_CALENDAR_EVENT_CANCELLED = "calendar.event_cancelled" as const;
export const EVENT_CALENDAR_REMINDER = "calendar.reminder" as const;
export const EVENT_CALENDAR_RSVP_CHANGED = "calendar.rsvp_changed" as const;
export const EVENT_CALENDAR_ATTENDEE_ADDED = "calendar.attendee_added" as const;
export const EVENT_CALENDAR_INVITATION = "calendar.invitation" as const;
export const EVENT_CALENDAR_EVENT_REQUIRES_RECONFIRM =
  "calendar.event_requires_reconfirm" as const;
export const EVENT_CALENDAR_CONFLICT_INTRODUCED =
  "calendar.conflict_introduced" as const;
export const EVENT_CALENDAR_AVAILABILITY_REQUEST =
  "calendar.availability_request" as const;
export const EVENT_CALENDAR_SYNC_FAILURE = "calendar.sync_failure" as const;
export const EVENT_CALENDAR_EXTERNAL_AUTH_EXPIRED =
  "calendar.external_auth_expired" as const;
/** @deprecated Prefer EVENT_CALENDAR_EVENT_UPDATED */
export const EVENT_CALENDAR_UPDATED = EVENT_CALENDAR_EVENT_UPDATED;
export const EVENT_INVENTORY_ITEM_CREATED = "inventory.item_created" as const;
export const EVENT_INVENTORY_ITEM_UPDATED = "inventory.item_updated" as const;
export const EVENT_INVENTORY_CONDITION_CHANGED = "inventory.condition_changed" as const;
export const EVENT_INVENTORY_ITEM_MISSING = "inventory.item_missing" as const;
export const EVENT_INVENTORY_ITEM_DISPOSED = "inventory.item_disposed" as const;
/** @deprecated Prefer EVENT_SUPPLY_LOW */
export const EVENT_INVENTORY_LOW = "inventory.low" as const;
export const EVENT_SUPPLY_LOW = "supply.low" as const;
export const EVENT_SUPPLY_OUT = "supply.out" as const;
export const EVENT_SUPPLY_RESTOCKED = "supply.restocked" as const;
export const EVENT_PANTRY_LOW = "pantry.low" as const;
export const EVENT_PANTRY_USE_SOON = "pantry.use_soon" as const;
export const EVENT_PANTRY_EXPIRED_DATE_REACHED = "pantry.expired_date_reached" as const;
export const EVENT_PANTRY_FINISHED = "pantry.finished" as const;
export const EVENT_PANTRY_DISCARDED = "pantry.discarded" as const;
export const EVENT_SHOPPING_ITEM_REQUESTED = "shopping.item_requested" as const;
export const EVENT_SHOPPING_ITEM_ASSIGNED = "shopping.item_assigned" as const;
export const EVENT_SHOPPING_ITEM_PURCHASED = "shopping.item_purchased" as const;
export const EVENT_SHOPPING_ITEM_UNAVAILABLE = "shopping.item_unavailable" as const;
export const EVENT_SHOPPING_ITEM_CANCELLED = "shopping.item_cancelled" as const;
export const EVENT_MAINTENANCE_REPORTED = "maintenance.reported" as const;
export const EVENT_MAINTENANCE_UPDATED = "maintenance.updated" as const;
/** @deprecated Prefer EVENT_MAINTENANCE_REPORTED */
export const EVENT_MAINTENANCE_DUE = EVENT_MAINTENANCE_REPORTED;
/** @deprecated Prefer EVENT_MAINTENANCE_UPDATED */
export const EVENT_MAINTENANCE_COMPLETED = EVENT_MAINTENANCE_UPDATED;
export const EVENT_APPROVAL_REQUESTED = "approval.requested" as const;
export const EVENT_APPROVAL_DECIDED = "approval.decided" as const;
export const EVENT_AGREEMENT_ACKNOWLEDGMENT_REQUIRED =
  "agreement.acknowledgment_required" as const;
/** @deprecated Prefer EVENT_AGREEMENT_ACKNOWLEDGMENT_REQUIRED */
export const EVENT_AGREEMENT_PROPOSED = EVENT_AGREEMENT_ACKNOWLEDGMENT_REQUIRED;
export const EVENT_AGREEMENT_ACCEPTED = "agreement.accepted" as const;

export const EVENT_GOVERNANCE_APPROVAL_REQUESTED =
  "governance.approval_requested" as const;
export const EVENT_GOVERNANCE_CHANGES_REQUESTED =
  "governance.changes_requested" as const;
export const EVENT_GOVERNANCE_PROPOSAL_REJECTED =
  "governance.proposal_rejected" as const;
export const EVENT_GOVERNANCE_PROPOSAL_APPROVED =
  "governance.proposal_approved" as const;
export const EVENT_GOVERNANCE_DOCUMENT_ACTIVATED =
  "governance.document_activated" as const;
export const EVENT_GOVERNANCE_DOCUMENT_SUPERSEDED =
  "governance.document_superseded" as const;
export const EVENT_GOVERNANCE_ACKNOWLEDGMENT_REQUESTED =
  "governance.acknowledgment_requested" as const;
export const EVENT_GOVERNANCE_ACKNOWLEDGMENT_OVERDUE =
  "governance.acknowledgment_overdue" as const;
export const EVENT_GOVERNANCE_TRANSITION_TASK =
  "governance.transition_task_assigned" as const;
export const EVENT_GOVERNANCE_TRANSITION_COMPLETED =
  "governance.transition_completed" as const;
export const EVENT_GOVERNANCE_MOVE_IN_CREATED =
  "governance.move_in_created" as const;
export const EVENT_GOVERNANCE_MOVE_OUT_CREATED =
  "governance.move_out_created" as const;
export const EVENT_HOUSEHOLD_INVITATION_CREATED =
  "household.invitation_created" as const;
export const EVENT_HOUSEHOLD_INVITATION_ACCEPTED =
  "household.invitation_accepted" as const;
export const EVENT_HOUSEHOLD_MEMBER_JOINED =
  "household.member_joined" as const;
export const EVENT_PAYMENT_ALLOCATION_CONFLICT =
  "payment.allocation_conflict" as const;
export const EVENT_DISPUTE_UPDATED = "dispute.updated" as const;
export const EVENT_DISPUTE_WITHDRAWN = "dispute.withdrawn" as const;
export const EVENT_EXPENSE_CONFIRMED = "expense.confirmed" as const;
export const EVENT_REIMBURSEMENT_REFUND_CREATED =
  "reimbursement.refund_created" as const;

/** Audit-log conceptual names → notification catalog keys */
export const CONCEPTUAL_EVENT_ALIASES = {
  "payment.submitted": EVENT_PAYMENT_AWAITING_CONFIRMATION,
  "reimbursement.waived": EVENT_WAIVER_CREATED,
  "reimbursement.waiver_reversed": EVENT_WAIVER_REVERSED,
} as const;

const PAYMENT_LINK = "/app/{householdId}/money/payments/{entityId}";
const REIMBURSEMENT_LINK = "/app/{householdId}/money/reimbursements/{entityId}";
const DISPUTE_LINK = "/app/{householdId}/money/disputes/{entityId}";
const EXPENSE_LINK = "/app/{householdId}/money/expenses/{entityId}";
const APP_LINK = "/app/{householdId}";
const CALENDAR_EVENT_LINK = "/app/{householdId}/calendar/event/{entityId}";

function entry(
  partial: Omit<CatalogEntry, "defaultChannels"> & {
    defaultChannels?: NotificationChannel[];
  },
): CatalogEntry {
  return {
    ...partial,
    defaultChannels: partial.defaultChannels ?? ["in_app", "push"],
  };
}

export const NOTIFICATION_CATALOG: Readonly<Record<string, CatalogEntry>> = {
  [EVENT_PAYMENT_AWAITING_CONFIRMATION]: entry({
    eventType: EVENT_PAYMENT_AWAITING_CONFIRMATION,
    category: "payments",
    defaultUrgency: "high",
    recipientRule: "payment_recipient",
    deepLinkPattern: PAYMENT_LINK,
    digestAllowed: false,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_PAYMENT_CONFIRMED]: entry({
    eventType: EVENT_PAYMENT_CONFIRMED,
    category: "payments",
    defaultUrgency: "normal",
    recipientRule: "payment_sender",
    deepLinkPattern: PAYMENT_LINK,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_PAYMENT_REJECTED]: entry({
    eventType: EVENT_PAYMENT_REJECTED,
    category: "payments",
    defaultUrgency: "high",
    recipientRule: "payment_sender",
    deepLinkPattern: PAYMENT_LINK,
    digestAllowed: false,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_PAYMENT_CANCELLED]: entry({
    eventType: EVENT_PAYMENT_CANCELLED,
    category: "payments",
    defaultUrgency: "normal",
    recipientRule: "payment_recipient",
    deepLinkPattern: PAYMENT_LINK,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_PAYMENT_REVERSED]: entry({
    eventType: EVENT_PAYMENT_REVERSED,
    category: "payments",
    defaultUrgency: "high",
    recipientRule: "other_party",
    deepLinkPattern: PAYMENT_LINK,
    digestAllowed: false,
    actionOriented: false,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_WAIVER_CREATED]: entry({
    eventType: EVENT_WAIVER_CREATED,
    category: "reimbursements",
    defaultUrgency: "normal",
    recipientRule: "debtor",
    deepLinkPattern: REIMBURSEMENT_LINK,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_WAIVER_REVERSED]: entry({
    eventType: EVENT_WAIVER_REVERSED,
    category: "reimbursements",
    defaultUrgency: "high",
    recipientRule: "debtor",
    deepLinkPattern: REIMBURSEMENT_LINK,
    digestAllowed: false,
    actionOriented: false,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_DISPUTE_OPENED]: entry({
    eventType: EVENT_DISPUTE_OPENED,
    category: "disputes",
    defaultUrgency: "high",
    recipientRule: "other_active_members",
    deepLinkPattern: DISPUTE_LINK,
    digestAllowed: false,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_DISPUTE_RESOLVED]: entry({
    eventType: EVENT_DISPUTE_RESOLVED,
    category: "disputes",
    defaultUrgency: "normal",
    recipientRule: "raiser",
    deepLinkPattern: DISPUTE_LINK,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_REFUND_OBLIGATION_CREATED]: entry({
    eventType: EVENT_REFUND_OBLIGATION_CREATED,
    category: "reimbursements",
    defaultUrgency: "high",
    recipientRule: "debtor",
    deepLinkPattern: REIMBURSEMENT_LINK,
    digestAllowed: false,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_EXPENSE_VOIDED]: entry({
    eventType: EVENT_EXPENSE_VOIDED,
    category: "expenses",
    defaultUrgency: "normal",
    recipientRule: "other_active_members",
    deepLinkPattern: EXPENSE_LINK,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_EXPENSE_AMENDED]: entry({
    eventType: EVENT_EXPENSE_AMENDED,
    category: "expenses",
    defaultUrgency: "normal",
    recipientRule: "other_active_members",
    deepLinkPattern: EXPENSE_LINK,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_SETTLEMENT_INTERMEDIARY_APPROVAL_REQUIRED]: entry({
    eventType: EVENT_SETTLEMENT_INTERMEDIARY_APPROVAL_REQUIRED,
    category: "payments",
    defaultUrgency: "high",
    recipientRule: "explicit",
    deepLinkPattern: "/app/{householdId}/money/simplify/{entityId}",
    digestAllowed: false,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_SETTLEMENT_RECIPIENT_ACCEPTANCE_REQUIRED]: entry({
    eventType: EVENT_SETTLEMENT_RECIPIENT_ACCEPTANCE_REQUIRED,
    category: "payments",
    defaultUrgency: "high",
    recipientRule: "explicit",
    deepLinkPattern: "/app/{householdId}/money/simplify/{entityId}",
    digestAllowed: false,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_SETTLEMENT_READY_TO_PAY]: entry({
    eventType: EVENT_SETTLEMENT_READY_TO_PAY,
    category: "payments",
    defaultUrgency: "high",
    recipientRule: "explicit",
    deepLinkPattern: "/app/{householdId}/money/simplify/{entityId}",
    digestAllowed: false,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_SETTLEMENT_PAYMENT_SUBMITTED]: entry({
    eventType: EVENT_SETTLEMENT_PAYMENT_SUBMITTED,
    category: "payments",
    defaultUrgency: "high",
    recipientRule: "explicit",
    deepLinkPattern: "/app/{householdId}/money/simplify/{entityId}",
    digestAllowed: false,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_SETTLEMENT_PAYMENT_CONFIRMED]: entry({
    eventType: EVENT_SETTLEMENT_PAYMENT_CONFIRMED,
    category: "payments",
    defaultUrgency: "normal",
    recipientRule: "explicit",
    deepLinkPattern: "/app/{householdId}/money/simplify/{entityId}",
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_SETTLEMENT_ROUTE_REVERSED]: entry({
    eventType: EVENT_SETTLEMENT_ROUTE_REVERSED,
    category: "payments",
    defaultUrgency: "high",
    recipientRule: "explicit",
    deepLinkPattern: "/app/{householdId}/money/simplify/{entityId}",
    digestAllowed: false,
    actionOriented: false,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_OPENING_BALANCE_CONFIRMATION_REQUIRED]: entry({
    eventType: EVENT_OPENING_BALANCE_CONFIRMATION_REQUIRED,
    category: "payments",
    defaultUrgency: "high",
    recipientRule: "explicit",
    deepLinkPattern: "/app/{householdId}/money/opening-balances/{entityId}",
    digestAllowed: false,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),

  // Future reserved
  [EVENT_CHORE_ASSIGNED]: entry({
    eventType: EVENT_CHORE_ASSIGNED,
    category: "chores",
    defaultUrgency: "normal",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/chores/{entityId}`,
    digestAllowed: true,
    actionOriented: true,
    privacy: "detailed_ok",
    active: true,
  }),
  [EVENT_CHORE_COMPLETED]: entry({
    eventType: EVENT_CHORE_COMPLETED,
    category: "chores",
    defaultUrgency: "low",
    recipientRule: "actor_excluded",
    deepLinkPattern: `${APP_LINK}/chores/{entityId}`,
    digestAllowed: true,
    actionOriented: false,
    privacy: "detailed_ok",
    active: true,
  }),
  [EVENT_CHORE_DUE_SOON]: entry({
    eventType: EVENT_CHORE_DUE_SOON,
    category: "chores",
    defaultUrgency: "high",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/chores/{entityId}`,
    digestAllowed: false,
    actionOriented: true,
    privacy: "detailed_ok",
    active: true,
  }),
  [EVENT_CHORE_OVERDUE]: entry({
    eventType: EVENT_CHORE_OVERDUE,
    category: "chores",
    defaultUrgency: "high",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/chores/{entityId}`,
    digestAllowed: false,
    actionOriented: true,
    privacy: "detailed_ok",
    active: true,
  }),
  [EVENT_CHORE_REASSIGNED]: entry({
    eventType: EVENT_CHORE_REASSIGNED,
    category: "chores",
    defaultUrgency: "normal",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/chores/{entityId}`,
    digestAllowed: true,
    actionOriented: true,
    privacy: "detailed_ok",
    active: true,
  }),
  [EVENT_CHORE_AWAITING_VERIFICATION]: entry({
    eventType: EVENT_CHORE_AWAITING_VERIFICATION,
    category: "chores",
    defaultUrgency: "high",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/chores/{entityId}`,
    digestAllowed: false,
    actionOriented: true,
    privacy: "detailed_ok",
    active: true,
  }),
  [EVENT_CHORE_REMINDER]: entry({
    eventType: EVENT_CHORE_REMINDER,
    category: "chores",
    defaultUrgency: "normal",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/chores/{entityId}`,
    digestAllowed: false,
    actionOriented: true,
    privacy: "detailed_ok",
    active: true,
  }),
  [EVENT_CHORE_REASSIGNMENT_REQUESTED]: entry({
    eventType: EVENT_CHORE_REASSIGNMENT_REQUESTED,
    category: "chores",
    defaultUrgency: "high",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/chores/{entityId}`,
    digestAllowed: false,
    actionOriented: true,
    privacy: "detailed_ok",
    active: true,
  }),
  [EVENT_CHORE_ROTATION_CREATED]: entry({
    eventType: EVENT_CHORE_ROTATION_CREATED,
    category: "chores",
    defaultUrgency: "low",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/chores/rotations/{entityId}`,
    digestAllowed: true,
    actionOriented: false,
    privacy: "detailed_ok",
    active: true,
  }),
  [EVENT_CHORE_ROTATION_UPDATED]: entry({
    eventType: EVENT_CHORE_ROTATION_UPDATED,
    category: "chores",
    defaultUrgency: "normal",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/chores/rotations/{entityId}`,
    digestAllowed: true,
    actionOriented: false,
    privacy: "detailed_ok",
    active: true,
  }),
  [EVENT_RESPONSIBILITY_TRANSFER_REQUESTED]: entry({
    eventType: EVENT_RESPONSIBILITY_TRANSFER_REQUESTED,
    category: "chores",
    defaultUrgency: "high",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/responsibilities`,
    digestAllowed: false,
    actionOriented: true,
    privacy: "detailed_ok",
    active: true,
  }),
  [EVENT_RESPONSIBILITY_TRANSFER_ACCEPTED]: entry({
    eventType: EVENT_RESPONSIBILITY_TRANSFER_ACCEPTED,
    category: "chores",
    defaultUrgency: "normal",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/responsibilities`,
    digestAllowed: true,
    actionOriented: false,
    privacy: "detailed_ok",
    active: true,
  }),
  [EVENT_RESPONSIBILITY_TRANSFER_DECLINED]: entry({
    eventType: EVENT_RESPONSIBILITY_TRANSFER_DECLINED,
    category: "chores",
    defaultUrgency: "normal",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/responsibilities`,
    digestAllowed: true,
    actionOriented: false,
    privacy: "detailed_ok",
    active: true,
  }),
  [EVENT_CALENDAR_EVENT_CREATED]: entry({
    eventType: EVENT_CALENDAR_EVENT_CREATED,
    category: "calendar",
    defaultUrgency: "normal",
    recipientRule: "involved_parties",
    deepLinkPattern: CALENDAR_EVENT_LINK,
    digestAllowed: true,
    actionOriented: false,
    privacy: "detailed_ok",
    active: true,
  }),
  [EVENT_CALENDAR_EVENT_UPDATED]: entry({
    eventType: EVENT_CALENDAR_EVENT_UPDATED,
    category: "calendar",
    defaultUrgency: "normal",
    recipientRule: "involved_parties",
    deepLinkPattern: CALENDAR_EVENT_LINK,
    digestAllowed: true,
    actionOriented: false,
    privacy: "detailed_ok",
    active: true,
  }),
  [EVENT_CALENDAR_EVENT_CANCELLED]: entry({
    eventType: EVENT_CALENDAR_EVENT_CANCELLED,
    category: "calendar",
    defaultUrgency: "normal",
    recipientRule: "involved_parties",
    deepLinkPattern: CALENDAR_EVENT_LINK,
    digestAllowed: true,
    actionOriented: false,
    privacy: "detailed_ok",
    active: true,
  }),
  [EVENT_CALENDAR_REMINDER]: entry({
    eventType: EVENT_CALENDAR_REMINDER,
    category: "calendar",
    defaultUrgency: "normal",
    recipientRule: "involved_parties",
    deepLinkPattern: CALENDAR_EVENT_LINK,
    digestAllowed: false,
    actionOriented: true,
    privacy: "detailed_ok",
    active: true,
  }),
  [EVENT_CALENDAR_RSVP_CHANGED]: entry({
    eventType: EVENT_CALENDAR_RSVP_CHANGED,
    category: "calendar",
    defaultUrgency: "low",
    recipientRule: "explicit",
    deepLinkPattern: CALENDAR_EVENT_LINK,
    digestAllowed: true,
    actionOriented: false,
    privacy: "detailed_ok",
    active: true,
  }),
  [EVENT_CALENDAR_ATTENDEE_ADDED]: entry({
    eventType: EVENT_CALENDAR_ATTENDEE_ADDED,
    category: "calendar",
    defaultUrgency: "normal",
    recipientRule: "explicit",
    deepLinkPattern: CALENDAR_EVENT_LINK,
    digestAllowed: true,
    actionOriented: false,
    privacy: "detailed_ok",
    active: false,
  }),
  [EVENT_CALENDAR_INVITATION]: entry({
    eventType: EVENT_CALENDAR_INVITATION,
    category: "calendar",
    defaultUrgency: "normal",
    recipientRule: "explicit",
    deepLinkPattern: CALENDAR_EVENT_LINK,
    digestAllowed: true,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_CALENDAR_EVENT_REQUIRES_RECONFIRM]: entry({
    eventType: EVENT_CALENDAR_EVENT_REQUIRES_RECONFIRM,
    category: "calendar",
    defaultUrgency: "high",
    recipientRule: "explicit",
    deepLinkPattern: CALENDAR_EVENT_LINK,
    digestAllowed: false,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_CALENDAR_CONFLICT_INTRODUCED]: entry({
    eventType: EVENT_CALENDAR_CONFLICT_INTRODUCED,
    category: "calendar",
    defaultUrgency: "high",
    recipientRule: "explicit",
    deepLinkPattern: CALENDAR_EVENT_LINK,
    digestAllowed: true,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_CALENDAR_AVAILABILITY_REQUEST]: entry({
    eventType: EVENT_CALENDAR_AVAILABILITY_REQUEST,
    category: "calendar",
    defaultUrgency: "normal",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/calendar/availability`,
    digestAllowed: true,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_CALENDAR_SYNC_FAILURE]: entry({
    eventType: EVENT_CALENDAR_SYNC_FAILURE,
    category: "calendar",
    defaultUrgency: "high",
    recipientRule: "self",
    deepLinkPattern: `${APP_LINK}/settings/integrations/calendar`,
    digestAllowed: true,
    actionOriented: true,
    privacy: "routing_only",
    active: true,
  }),
  [EVENT_CALENDAR_EXTERNAL_AUTH_EXPIRED]: entry({
    eventType: EVENT_CALENDAR_EXTERNAL_AUTH_EXPIRED,
    category: "calendar",
    defaultUrgency: "high",
    recipientRule: "self",
    deepLinkPattern: `${APP_LINK}/settings/integrations/calendar`,
    digestAllowed: false,
    actionOriented: true,
    privacy: "routing_only",
    active: true,
  }),
  [EVENT_INVENTORY_ITEM_CREATED]: entry({
    eventType: EVENT_INVENTORY_ITEM_CREATED,
    category: "inventory",
    defaultUrgency: "low",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/house/inventory/{entityId}`,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_INVENTORY_ITEM_UPDATED]: entry({
    eventType: EVENT_INVENTORY_ITEM_UPDATED,
    category: "inventory",
    defaultUrgency: "low",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/house/inventory/{entityId}`,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_INVENTORY_CONDITION_CHANGED]: entry({
    eventType: EVENT_INVENTORY_CONDITION_CHANGED,
    category: "inventory",
    defaultUrgency: "normal",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/house/inventory/{entityId}`,
    digestAllowed: true,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_INVENTORY_ITEM_MISSING]: entry({
    eventType: EVENT_INVENTORY_ITEM_MISSING,
    category: "inventory",
    defaultUrgency: "high",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/house/inventory/{entityId}`,
    digestAllowed: false,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_INVENTORY_ITEM_DISPOSED]: entry({
    eventType: EVENT_INVENTORY_ITEM_DISPOSED,
    category: "inventory",
    defaultUrgency: "normal",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/house/inventory/{entityId}`,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_INVENTORY_LOW]: entry({
    eventType: EVENT_INVENTORY_LOW,
    category: "inventory",
    defaultUrgency: "normal",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/house/supplies/{entityId}`,
    digestAllowed: true,
    actionOriented: true,
    privacy: "generic_ok",
    active: false,
  }),
  [EVENT_SUPPLY_LOW]: entry({
    eventType: EVENT_SUPPLY_LOW,
    category: "inventory",
    defaultUrgency: "normal",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/house/supplies/{entityId}`,
    digestAllowed: true,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_SUPPLY_OUT]: entry({
    eventType: EVENT_SUPPLY_OUT,
    category: "inventory",
    defaultUrgency: "high",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/house/supplies/{entityId}`,
    digestAllowed: true,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_SUPPLY_RESTOCKED]: entry({
    eventType: EVENT_SUPPLY_RESTOCKED,
    category: "inventory",
    defaultUrgency: "low",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/house/supplies/{entityId}`,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_PANTRY_LOW]: entry({
    eventType: EVENT_PANTRY_LOW,
    category: "inventory",
    defaultUrgency: "normal",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/house/pantry/{entityId}`,
    digestAllowed: true,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_PANTRY_USE_SOON]: entry({
    eventType: EVENT_PANTRY_USE_SOON,
    category: "inventory",
    defaultUrgency: "normal",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/house/pantry/{entityId}`,
    digestAllowed: true,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_PANTRY_EXPIRED_DATE_REACHED]: entry({
    eventType: EVENT_PANTRY_EXPIRED_DATE_REACHED,
    category: "inventory",
    defaultUrgency: "normal",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/house/pantry/{entityId}`,
    digestAllowed: true,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_PANTRY_FINISHED]: entry({
    eventType: EVENT_PANTRY_FINISHED,
    category: "inventory",
    defaultUrgency: "low",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/house/pantry/{entityId}`,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_PANTRY_DISCARDED]: entry({
    eventType: EVENT_PANTRY_DISCARDED,
    category: "inventory",
    defaultUrgency: "low",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/house/pantry/{entityId}`,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_SHOPPING_ITEM_REQUESTED]: entry({
    eventType: EVENT_SHOPPING_ITEM_REQUESTED,
    category: "shopping",
    defaultUrgency: "low",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/house/shopping/{entityId}`,
    digestAllowed: true,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_SHOPPING_ITEM_ASSIGNED]: entry({
    eventType: EVENT_SHOPPING_ITEM_ASSIGNED,
    category: "shopping",
    defaultUrgency: "normal",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/house/shopping/{entityId}`,
    digestAllowed: true,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_SHOPPING_ITEM_PURCHASED]: entry({
    eventType: EVENT_SHOPPING_ITEM_PURCHASED,
    category: "shopping",
    defaultUrgency: "normal",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/house/shopping/{entityId}`,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_SHOPPING_ITEM_UNAVAILABLE]: entry({
    eventType: EVENT_SHOPPING_ITEM_UNAVAILABLE,
    category: "shopping",
    defaultUrgency: "normal",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/house/shopping/{entityId}`,
    digestAllowed: true,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_SHOPPING_ITEM_CANCELLED]: entry({
    eventType: EVENT_SHOPPING_ITEM_CANCELLED,
    category: "shopping",
    defaultUrgency: "low",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/house/shopping/{entityId}`,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_MAINTENANCE_REPORTED]: entry({
    eventType: EVENT_MAINTENANCE_REPORTED,
    category: "maintenance",
    defaultUrgency: "high",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/maintenance/{entityId}`,
    digestAllowed: false,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_MAINTENANCE_UPDATED]: entry({
    eventType: EVENT_MAINTENANCE_UPDATED,
    category: "maintenance",
    defaultUrgency: "normal",
    recipientRule: "actor_excluded",
    deepLinkPattern: `${APP_LINK}/maintenance/{entityId}`,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: true,
  }),
  "maintenance.assigned": entry({
    eventType: "maintenance.assigned",
    category: "maintenance",
    defaultUrgency: "high",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/maintenance/{entityId}`,
    digestAllowed: false,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  "maintenance.resolved": entry({
    eventType: "maintenance.resolved",
    category: "maintenance",
    defaultUrgency: "normal",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/maintenance/{entityId}`,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: true,
  }),
  "maintenance.reopened": entry({
    eventType: "maintenance.reopened",
    category: "maintenance",
    defaultUrgency: "urgent",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/maintenance/{entityId}`,
    digestAllowed: false,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  "maintenance.appointment_scheduled": entry({
    eventType: "maintenance.appointment_scheduled",
    category: "maintenance",
    defaultUrgency: "high",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/maintenance/{entityId}`,
    digestAllowed: false,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  "maintenance.evidence_added": entry({
    eventType: "maintenance.evidence_added",
    category: "maintenance",
    defaultUrgency: "low",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/maintenance/{entityId}`,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: true,
  }),
  "maintenance.comment_added": entry({
    eventType: "maintenance.comment_added",
    category: "maintenance",
    defaultUrgency: "normal",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/maintenance/{entityId}`,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: true,
  }),
  "maintenance.waiting_on_household": entry({
    eventType: "maintenance.waiting_on_household",
    category: "maintenance",
    defaultUrgency: "high",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/maintenance/{entityId}`,
    digestAllowed: false,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  "maintenance.expense_linked": entry({
    eventType: "maintenance.expense_linked",
    category: "maintenance",
    defaultUrgency: "low",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/maintenance/{entityId}`,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_APPROVAL_REQUESTED]: entry({
    eventType: EVENT_APPROVAL_REQUESTED,
    category: "approvals",
    defaultUrgency: "high",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/governance/documents/{entityId}`,
    digestAllowed: false,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_APPROVAL_DECIDED]: entry({
    eventType: EVENT_APPROVAL_DECIDED,
    category: "approvals",
    defaultUrgency: "normal",
    recipientRule: "raiser",
    deepLinkPattern: `${APP_LINK}/governance/documents/{entityId}`,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_AGREEMENT_ACKNOWLEDGMENT_REQUIRED]: entry({
    eventType: EVENT_AGREEMENT_ACKNOWLEDGMENT_REQUIRED,
    category: "agreements",
    defaultUrgency: "normal",
    recipientRule: "other_active_members",
    deepLinkPattern: `${APP_LINK}/governance/acknowledgments`,
    digestAllowed: true,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_AGREEMENT_ACCEPTED]: entry({
    eventType: EVENT_AGREEMENT_ACCEPTED,
    category: "agreements",
    defaultUrgency: "low",
    recipientRule: "involved_parties",
    deepLinkPattern: `${APP_LINK}/governance/documents/{entityId}`,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_GOVERNANCE_APPROVAL_REQUESTED]: entry({
    eventType: EVENT_GOVERNANCE_APPROVAL_REQUESTED,
    category: "approvals",
    defaultUrgency: "high",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/governance/documents/{entityId}`,
    digestAllowed: false,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_GOVERNANCE_CHANGES_REQUESTED]: entry({
    eventType: EVENT_GOVERNANCE_CHANGES_REQUESTED,
    category: "approvals",
    defaultUrgency: "normal",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/governance/documents/{entityId}`,
    digestAllowed: false,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_GOVERNANCE_PROPOSAL_REJECTED]: entry({
    eventType: EVENT_GOVERNANCE_PROPOSAL_REJECTED,
    category: "approvals",
    defaultUrgency: "high",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/governance/documents/{entityId}`,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_GOVERNANCE_PROPOSAL_APPROVED]: entry({
    eventType: EVENT_GOVERNANCE_PROPOSAL_APPROVED,
    category: "approvals",
    defaultUrgency: "normal",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/governance/documents/{entityId}`,
    digestAllowed: true,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_GOVERNANCE_DOCUMENT_ACTIVATED]: entry({
    eventType: EVENT_GOVERNANCE_DOCUMENT_ACTIVATED,
    category: "agreements",
    defaultUrgency: "normal",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/governance/documents/{entityId}`,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_GOVERNANCE_DOCUMENT_SUPERSEDED]: entry({
    eventType: EVENT_GOVERNANCE_DOCUMENT_SUPERSEDED,
    category: "agreements",
    defaultUrgency: "normal",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/governance/documents/{entityId}`,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_GOVERNANCE_ACKNOWLEDGMENT_REQUESTED]: entry({
    eventType: EVENT_GOVERNANCE_ACKNOWLEDGMENT_REQUESTED,
    category: "agreements",
    defaultUrgency: "normal",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/governance/acknowledgments`,
    digestAllowed: true,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_GOVERNANCE_ACKNOWLEDGMENT_OVERDUE]: entry({
    eventType: EVENT_GOVERNANCE_ACKNOWLEDGMENT_OVERDUE,
    category: "agreements",
    defaultUrgency: "high",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/governance/acknowledgments`,
    digestAllowed: false,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_GOVERNANCE_TRANSITION_TASK]: entry({
    eventType: EVENT_GOVERNANCE_TRANSITION_TASK,
    category: "agreements",
    defaultUrgency: "normal",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/governance/transitions/{entityId}`,
    digestAllowed: true,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_GOVERNANCE_TRANSITION_COMPLETED]: entry({
    eventType: EVENT_GOVERNANCE_TRANSITION_COMPLETED,
    category: "agreements",
    defaultUrgency: "normal",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/governance/transitions/{entityId}`,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_GOVERNANCE_MOVE_IN_CREATED]: entry({
    eventType: EVENT_GOVERNANCE_MOVE_IN_CREATED,
    category: "agreements",
    defaultUrgency: "normal",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/governance/transitions/{entityId}`,
    digestAllowed: true,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_GOVERNANCE_MOVE_OUT_CREATED]: entry({
    eventType: EVENT_GOVERNANCE_MOVE_OUT_CREATED,
    category: "agreements",
    defaultUrgency: "normal",
    recipientRule: "explicit",
    deepLinkPattern: `${APP_LINK}/governance/transitions/{entityId}`,
    digestAllowed: true,
    actionOriented: true,
    privacy: "generic_ok",
    active: true,
  }),
  [EVENT_HOUSEHOLD_INVITATION_CREATED]: entry({
    eventType: EVENT_HOUSEHOLD_INVITATION_CREATED,
    category: "membership",
    defaultUrgency: "normal",
    recipientRule: "explicit",
    deepLinkPattern: "/join",
    digestAllowed: false,
    actionOriented: true,
    privacy: "routing_only",
    active: false,
  }),
  [EVENT_HOUSEHOLD_INVITATION_ACCEPTED]: entry({
    eventType: EVENT_HOUSEHOLD_INVITATION_ACCEPTED,
    category: "membership",
    defaultUrgency: "normal",
    recipientRule: "other_active_members",
    deepLinkPattern: APP_LINK,
    digestAllowed: true,
    actionOriented: false,
    privacy: "detailed_ok",
    active: false,
  }),
  [EVENT_HOUSEHOLD_MEMBER_JOINED]: entry({
    eventType: EVENT_HOUSEHOLD_MEMBER_JOINED,
    category: "membership",
    defaultUrgency: "normal",
    recipientRule: "other_active_members",
    deepLinkPattern: APP_LINK,
    digestAllowed: true,
    actionOriented: false,
    privacy: "detailed_ok",
    active: false,
  }),
  [EVENT_PAYMENT_ALLOCATION_CONFLICT]: entry({
    eventType: EVENT_PAYMENT_ALLOCATION_CONFLICT,
    category: "payments",
    defaultUrgency: "urgent",
    recipientRule: "involved_parties",
    deepLinkPattern: PAYMENT_LINK,
    digestAllowed: false,
    actionOriented: true,
    privacy: "routing_only",
    active: false,
  }),
  [EVENT_DISPUTE_UPDATED]: entry({
    eventType: EVENT_DISPUTE_UPDATED,
    category: "disputes",
    defaultUrgency: "normal",
    recipientRule: "involved_parties",
    deepLinkPattern: DISPUTE_LINK,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: false,
  }),
  [EVENT_DISPUTE_WITHDRAWN]: entry({
    eventType: EVENT_DISPUTE_WITHDRAWN,
    category: "disputes",
    defaultUrgency: "low",
    recipientRule: "other_active_members",
    deepLinkPattern: DISPUTE_LINK,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: false,
  }),
  [EVENT_EXPENSE_CONFIRMED]: entry({
    eventType: EVENT_EXPENSE_CONFIRMED,
    category: "expenses",
    defaultUrgency: "normal",
    recipientRule: "other_active_members",
    deepLinkPattern: EXPENSE_LINK,
    digestAllowed: true,
    actionOriented: false,
    privacy: "generic_ok",
    active: false,
  }),
  [EVENT_REIMBURSEMENT_REFUND_CREATED]: entry({
    eventType: EVENT_REIMBURSEMENT_REFUND_CREATED,
    category: "reimbursements",
    defaultUrgency: "high",
    recipientRule: "involved_parties",
    deepLinkPattern: REIMBURSEMENT_LINK,
    digestAllowed: false,
    actionOriented: true,
    privacy: "generic_ok",
    active: false,
  }),
};

export function getCatalogEntry(eventType: string): CatalogEntry | undefined {
  return NOTIFICATION_CATALOG[eventType];
}

export const ACTIVE_EVENT_TYPES: readonly string[] = Object.values(
  NOTIFICATION_CATALOG,
)
  .filter((e) => e.active)
  .map((e) => e.eventType);

export function isActiveEventType(eventType: string): boolean {
  return getCatalogEntry(eventType)?.active === true;
}

export type CategoryPreferenceDefaults = {
  deliveryMode: DeliveryMode;
  channels: NotificationChannel[];
  defaultUrgency: NotificationUrgency;
  quietHoursRespected: boolean;
};

/** Default preference seeds by category (user prefs overlay these). */
export const CATEGORY_PREFERENCE_DEFAULTS: Record<
  NotificationCategory,
  CategoryPreferenceDefaults
> = {
  payments: {
    deliveryMode: "immediate",
    channels: ["in_app", "push"],
    defaultUrgency: "high",
    quietHoursRespected: true,
  },
  disputes: {
    deliveryMode: "immediate",
    channels: ["in_app", "push"],
    defaultUrgency: "high",
    quietHoursRespected: true,
  },
  expenses: {
    deliveryMode: "immediate",
    channels: ["in_app", "push"],
    defaultUrgency: "normal",
    quietHoursRespected: true,
  },
  reimbursements: {
    deliveryMode: "immediate",
    channels: ["in_app", "push"],
    defaultUrgency: "normal",
    quietHoursRespected: true,
  },
  membership: {
    deliveryMode: "immediate",
    channels: ["in_app", "push", "email"],
    defaultUrgency: "normal",
    quietHoursRespected: false,
  },
  chores: {
    deliveryMode: "daily_digest",
    channels: ["in_app", "push"],
    defaultUrgency: "normal",
    quietHoursRespected: true,
  },
  calendar: {
    deliveryMode: "immediate",
    channels: ["in_app", "push"],
    defaultUrgency: "normal",
    quietHoursRespected: true,
  },
  inventory: {
    deliveryMode: "daily_digest",
    channels: ["in_app", "push"],
    defaultUrgency: "normal",
    quietHoursRespected: true,
  },
  shopping: {
    deliveryMode: "daily_digest",
    channels: ["in_app", "push"],
    defaultUrgency: "low",
    quietHoursRespected: true,
  },
  maintenance: {
    deliveryMode: "immediate",
    channels: ["in_app", "push"],
    defaultUrgency: "high",
    quietHoursRespected: true,
  },
  approvals: {
    deliveryMode: "immediate",
    channels: ["in_app", "push"],
    defaultUrgency: "high",
    quietHoursRespected: true,
  },
  agreements: {
    deliveryMode: "immediate",
    channels: ["in_app", "push"],
    defaultUrgency: "normal",
    quietHoursRespected: true,
  },
  system: {
    deliveryMode: "immediate",
    channels: ["in_app"],
    defaultUrgency: "normal",
    quietHoursRespected: false,
  },
};
