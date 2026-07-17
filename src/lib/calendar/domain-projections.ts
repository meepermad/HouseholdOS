/**
 * Domain-backed calendar event projection metadata.
 * Source domains own lifecycle; calendar stores a non-authoritative projection.
 */

export type CalendarSourceType =
  | "native"
  | "chore"
  | "meal_plan"
  | "meal_request"
  | "maintenance_appointment"
  | "maintenance_reminder"
  | "governance_review"
  | "governance_effective"
  | "governance_acknowledgment"
  | "governance_move_in"
  | "governance_move_out"
  | "finance_due"
  | "reimbursement_reminder"
  | "inventory_reminder"
  | "supply_reminder"
  | "household_invitation"
  | "external_google"
  | "external_ics"
  | null
  | string;

export type DomainProjectionMeta = {
  sourceType: CalendarSourceType;
  label: string;
  badge: string;
  editableInCalendar: boolean;
  deletableInCalendar: boolean;
  lifecycleOwner: "householdos" | "domain" | "external";
  deepLink: (householdId: string, sourceId: string, eventId: string) => string;
  editableFields: string[];
  readOnlyExplanation: string | null;
};

const NATIVE: DomainProjectionMeta = {
  sourceType: "native",
  label: "HouseholdOS event",
  badge: "Native",
  editableInCalendar: true,
  deletableInCalendar: true,
  lifecycleOwner: "householdos",
  deepLink: (householdId, _sourceId, eventId) =>
    `/app/${householdId}/calendar/event/${eventId}`,
  editableFields: [
    "title",
    "description",
    "location",
    "time",
    "visibility",
    "attendees",
    "reminders",
    "recurrence",
  ],
  readOnlyExplanation: null,
};

const DOMAIN_MAP: Record<string, DomainProjectionMeta> = {
  chore: {
    sourceType: "chore",
    label: "Chore",
    badge: "Chore",
    editableInCalendar: false,
    deletableInCalendar: false,
    lifecycleOwner: "domain",
    deepLink: (householdId, sourceId) =>
      `/app/${householdId}/chores/${sourceId}`,
    editableFields: [],
    readOnlyExplanation:
      "Edit this chore from the chores domain. Completing it here uses the chore action.",
  },
  meal_plan: {
    sourceType: "meal_plan",
    label: "Meal",
    badge: "Meal",
    editableInCalendar: false,
    deletableInCalendar: false,
    lifecycleOwner: "domain",
    deepLink: (householdId, sourceId) =>
      `/app/${householdId}/meals/${sourceId}`,
    editableFields: [],
    readOnlyExplanation:
      "Change the meal date from the meals domain, not by editing this projection.",
  },
  meal_request: {
    sourceType: "meal_request",
    label: "Meal request",
    badge: "Meal",
    editableInCalendar: false,
    deletableInCalendar: false,
    lifecycleOwner: "domain",
    deepLink: (householdId, sourceId) =>
      `/app/${householdId}/meals/requests/${sourceId}`,
    editableFields: [],
    readOnlyExplanation: "Edit from the meals domain.",
  },
  maintenance_appointment: {
    sourceType: "maintenance_appointment",
    label: "Maintenance appointment",
    badge: "Maintenance",
    editableInCalendar: false,
    deletableInCalendar: false,
    lifecycleOwner: "domain",
    deepLink: (householdId, sourceId) =>
      `/app/${householdId}/maintenance/${sourceId}`,
    editableFields: [],
    readOnlyExplanation:
      "Cancelling this calendar item does not cancel the maintenance request.",
  },
  maintenance_reminder: {
    sourceType: "maintenance_reminder",
    label: "Maintenance reminder",
    badge: "Maintenance",
    editableInCalendar: false,
    deletableInCalendar: false,
    lifecycleOwner: "domain",
    deepLink: (householdId, sourceId) =>
      `/app/${householdId}/maintenance/${sourceId}`,
    editableFields: [],
    readOnlyExplanation: "Managed by the maintenance domain.",
  },
  governance_review: {
    sourceType: "governance_review",
    label: "Governance review",
    badge: "Governance",
    editableInCalendar: false,
    deletableInCalendar: false,
    lifecycleOwner: "domain",
    deepLink: (householdId, sourceId) =>
      `/app/${householdId}/governance/${sourceId}`,
    editableFields: [],
    readOnlyExplanation: "Governance lifecycle restrictions apply.",
  },
  governance_effective: {
    sourceType: "governance_effective",
    label: "Governance effective date",
    badge: "Governance",
    editableInCalendar: false,
    deletableInCalendar: false,
    lifecycleOwner: "domain",
    deepLink: (householdId, sourceId) =>
      `/app/${householdId}/governance/${sourceId}`,
    editableFields: [],
    readOnlyExplanation: "Governance immutability applies.",
  },
  governance_acknowledgment: {
    sourceType: "governance_acknowledgment",
    label: "Acknowledgment deadline",
    badge: "Governance",
    editableInCalendar: false,
    deletableInCalendar: false,
    lifecycleOwner: "domain",
    deepLink: (householdId, sourceId) =>
      `/app/${householdId}/governance/${sourceId}`,
    editableFields: [],
    readOnlyExplanation: "Managed by governance.",
  },
  governance_move_in: {
    sourceType: "governance_move_in",
    label: "Move-in",
    badge: "Governance",
    editableInCalendar: false,
    deletableInCalendar: false,
    lifecycleOwner: "domain",
    deepLink: (householdId, sourceId) =>
      `/app/${householdId}/governance/transitions/${sourceId}`,
    editableFields: [],
    readOnlyExplanation: "Managed by the move-in workflow.",
  },
  governance_move_out: {
    sourceType: "governance_move_out",
    label: "Move-out",
    badge: "Governance",
    editableInCalendar: false,
    deletableInCalendar: false,
    lifecycleOwner: "domain",
    deepLink: (householdId, sourceId) =>
      `/app/${householdId}/governance/transitions/${sourceId}`,
    editableFields: [],
    readOnlyExplanation: "Managed by the move-out workflow.",
  },
  finance_due: {
    sourceType: "finance_due",
    label: "Financial due date",
    badge: "Money",
    editableInCalendar: false,
    deletableInCalendar: false,
    lifecycleOwner: "domain",
    deepLink: (householdId, sourceId) =>
      `/app/${householdId}/money/${sourceId}`,
    editableFields: [],
    readOnlyExplanation:
      "Calendar events never mutate financial balances. Edit from Money.",
  },
  reimbursement_reminder: {
    sourceType: "reimbursement_reminder",
    label: "Reimbursement reminder",
    badge: "Money",
    editableInCalendar: false,
    deletableInCalendar: false,
    lifecycleOwner: "domain",
    deepLink: (householdId, sourceId) =>
      `/app/${householdId}/money/${sourceId}`,
    editableFields: [],
    readOnlyExplanation: "Managed by finances.",
  },
  inventory_reminder: {
    sourceType: "inventory_reminder",
    label: "Inventory reminder",
    badge: "Inventory",
    editableInCalendar: false,
    deletableInCalendar: false,
    lifecycleOwner: "domain",
    deepLink: (householdId, sourceId) =>
      `/app/${householdId}/house/inventory/${sourceId}`,
    editableFields: [],
    readOnlyExplanation: "Managed by house resources.",
  },
  supply_reminder: {
    sourceType: "supply_reminder",
    label: "Supply reminder",
    badge: "Supplies",
    editableInCalendar: false,
    deletableInCalendar: false,
    lifecycleOwner: "domain",
    deepLink: (householdId, sourceId) =>
      `/app/${householdId}/house/supplies/${sourceId}`,
    editableFields: [],
    readOnlyExplanation: "Managed by house resources.",
  },
  external_google: {
    sourceType: "external_google",
    label: "Google Calendar",
    badge: "Google",
    editableInCalendar: false,
    deletableInCalendar: false,
    lifecycleOwner: "external",
    deepLink: (householdId, _sourceId, eventId) =>
      `/app/${householdId}/calendar/event/${eventId}`,
    editableFields: [],
    readOnlyExplanation:
      "External events are read-only unless two-way sync is enabled and confirmed by the provider.",
  },
  external_ics: {
    sourceType: "external_ics",
    label: "Imported ICS",
    badge: "ICS",
    editableInCalendar: true,
    deletableInCalendar: true,
    lifecycleOwner: "householdos",
    deepLink: (householdId, _sourceId, eventId) =>
      `/app/${householdId}/calendar/event/${eventId}`,
    editableFields: ["title", "description", "location", "time"],
    readOnlyExplanation: null,
  },
};

export function resolveDomainProjection(
  sourceType: string | null | undefined,
): DomainProjectionMeta {
  if (!sourceType || sourceType === "native") return NATIVE;
  return DOMAIN_MAP[sourceType] ?? {
    ...NATIVE,
    sourceType,
    label: sourceType,
    badge: "Linked",
    editableInCalendar: false,
    deletableInCalendar: false,
    lifecycleOwner: "domain",
    editableFields: [],
    readOnlyExplanation: "Managed by its source domain.",
  };
}

export function calendarEventPath(householdId: string, eventId: string): string {
  return `/app/${householdId}/calendar/event/${eventId}`;
}
