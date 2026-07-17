/**
 * Typed household app routes. Encode path params safely; never put feed tokens
 * or external/secret URLs here.
 */

const SAFE_SEGMENT_RE = /^[A-Za-z0-9_-]+$/;

export function assertRouteSegment(value: string, label: string): string {
  if (!value || !SAFE_SEGMENT_RE.test(value)) {
    throw new Error(`Invalid ${label} for route generation`);
  }
  return value;
}

function base(householdId: string): string {
  return `/app/${assertRouteSegment(householdId, "household id")}`;
}

export type CalendarViewSlug = "agenda" | "day" | "week" | "month";

export const householdRoutes = {
  home: (householdId: string) => base(householdId),

  calendar: {
    index: (householdId: string) => `${base(householdId)}/calendar`,
    agenda: (householdId: string, date?: string) => {
      const path = `${base(householdId)}/calendar/agenda`;
      return date ? `${path}?date=${encodeURIComponent(date)}` : path;
    },
    day: (householdId: string, date?: string) => {
      const path = `${base(householdId)}/calendar/day`;
      return date ? `${path}?date=${encodeURIComponent(date)}` : path;
    },
    week: (householdId: string, date?: string) => {
      const path = `${base(householdId)}/calendar/week`;
      return date ? `${path}?date=${encodeURIComponent(date)}` : path;
    },
    month: (householdId: string, date?: string) => {
      const path = `${base(householdId)}/calendar/month`;
      return date ? `${path}?date=${encodeURIComponent(date)}` : path;
    },
    view: (householdId: string, view: CalendarViewSlug, date?: string) => {
      const path = `${base(householdId)}/calendar/${view}`;
      return date ? `${path}?date=${encodeURIComponent(date)}` : path;
    },
    new: (householdId: string) => `${base(householdId)}/calendar/new`,
    invitations: (householdId: string) =>
      `${base(householdId)}/calendar/invitations`,
    availability: (householdId: string) =>
      `${base(householdId)}/calendar/availability`,
    event: (householdId: string, eventId: string) =>
      `${base(householdId)}/calendar/event/${assertRouteSegment(eventId, "event id")}`,
    eventEdit: (householdId: string, eventId: string) =>
      `${base(householdId)}/calendar/event/${assertRouteSegment(eventId, "event id")}/edit`,
    /** Legacy plural detail path (redirects to singular). */
    eventsLegacy: (householdId: string, eventId: string) =>
      `${base(householdId)}/calendar/events/${assertRouteSegment(eventId, "event id")}`,
  },

  chores: {
    index: (householdId: string) => `${base(householdId)}/chores`,
    new: (householdId: string) => `${base(householdId)}/chores/new`,
    mine: (householdId: string) => `${base(householdId)}/chores/mine`,
  },

  responsibilities: (householdId: string) =>
    `${base(householdId)}/responsibilities`,

  money: {
    index: (householdId: string) => `${base(householdId)}/money`,
    expensesNew: (householdId: string) =>
      `${base(householdId)}/money/expenses/new`,
    receipts: (householdId: string) =>
      `${base(householdId)}/money/receipts`,
    receiptNew: (householdId: string) =>
      `${base(householdId)}/money/receipts/new`,
    receipt: (householdId: string, receiptId: string) =>
      `${base(householdId)}/money/receipts/${assertRouteSegment(receiptId, "receipt id")}`,
    payments: (householdId: string, paymentId: string) =>
      `${base(householdId)}/money/payments/${assertRouteSegment(paymentId, "payment id")}`,
    disputes: (householdId: string, disputeId: string) =>
      `${base(householdId)}/money/disputes/${assertRouteSegment(disputeId, "dispute id")}`,
    reimbursements: (householdId: string, obligationId: string) =>
      `${base(householdId)}/money/reimbursements/${assertRouteSegment(obligationId, "obligation id")}`,
  },

  setup: (householdId: string) => `${base(householdId)}/setup`,

  house: {
    index: (householdId: string) => `${base(householdId)}/house`,
    shopping: (householdId: string) => `${base(householdId)}/house/shopping`,
  },

  meals: {
    new: (householdId: string) => `${base(householdId)}/meals/new`,
  },

  maintenance: {
    index: (householdId: string) => `${base(householdId)}/maintenance`,
    new: (householdId: string) => `${base(householdId)}/maintenance/new`,
    detail: (householdId: string, id: string) =>
      `${base(householdId)}/maintenance/${assertRouteSegment(id, "maintenance id")}`,
  },

  governance: {
    index: (householdId: string) => `${base(householdId)}/governance`,
    approvals: (householdId: string) =>
      `${base(householdId)}/governance/approvals`,
    acknowledgments: (householdId: string) =>
      `${base(householdId)}/governance/acknowledgments`,
  },

  notifications: (householdId: string) =>
    `${base(householdId)}/notifications`,

  settings: {
    index: (householdId: string) => `${base(householdId)}/settings`,
    profile: (householdId: string) => `${base(householdId)}/settings/profile`,
    calendar: (householdId: string) =>
      `${base(householdId)}/settings/calendar`,
    import: (householdId: string) => `${base(householdId)}/settings/import`,
    export: (householdId: string) => `${base(householdId)}/settings/export`,
  },

  search: (householdId: string) => `${base(householdId)}/search`,
  polls: {
    index: (householdId: string) => `${base(householdId)}/polls`,
    new: (householdId: string) => `${base(householdId)}/polls/new`,
  },
  utilities: (householdId: string) => `${base(householdId)}/utilities`,
  emergency: (householdId: string) => `${base(householdId)}/emergency`,
  guestsNew: (householdId: string) => `${base(householdId)}/guests/new`,
  away: (householdId: string) => `${base(householdId)}/away`,
  review: (householdId: string) => `${base(householdId)}/review`,
} as const;

/** True when pathname is any Calendar app route for this household. */
export function isCalendarPath(pathname: string, householdId: string): boolean {
  return pathname.startsWith(`${base(householdId)}/calendar`);
}

/** Legacy Calendar path redirects (UI only; never feed/API). */
export const CALENDAR_LEGACY_REDIRECTS = {
  indexToAgenda: true,
  eventsNewToNew: true,
  eventsDetailToEvent: true,
} as const;
