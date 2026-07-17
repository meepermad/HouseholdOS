/**
 * Google Calendar OAuth + sync client boundary.
 * Live API calls are gated; tests inject a mock provider.
 */

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
] as const;

export type GoogleCalendarListEntry = {
  id: string;
  summary: string;
  primary?: boolean;
  accessRole?: string;
};

export type GoogleEvent = {
  id: string;
  etag?: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  recurringEventId?: string;
  updated?: string;
};

export type GoogleCalendarProvider = {
  listCalendars(accessToken: string): Promise<GoogleCalendarListEntry[]>;
  listEvents(params: {
    accessToken: string;
    calendarId: string;
    syncToken?: string | null;
    timeMin?: string;
    timeMax?: string;
  }): Promise<{
    events: GoogleEvent[];
    nextSyncToken?: string | null;
    deletedIds?: string[];
  }>;
  upsertEvent(params: {
    accessToken: string;
    calendarId: string;
    event: Partial<GoogleEvent> & { id?: string };
  }): Promise<GoogleEvent>;
  deleteEvent(params: {
    accessToken: string;
    calendarId: string;
    eventId: string;
  }): Promise<void>;
};

export function buildGoogleAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scopes?: readonly string[];
}): string {
  const scopes = (params.scopes ?? GOOGLE_CALENDAR_SCOPES).join(" ");
  const q = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    scope: scopes,
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q.toString()}`;
}

export function createMockGoogleProvider(
  seed: GoogleEvent[] = [],
): GoogleCalendarProvider {
  const store = new Map(seed.map((e) => [e.id, e]));
  return {
    async listCalendars() {
      return [{ id: "primary", summary: "Primary", primary: true }];
    },
    async listEvents() {
      return {
        events: [...store.values()],
        nextSyncToken: "mock-sync-token",
        deletedIds: [],
      };
    },
    async upsertEvent({ event }) {
      const id = event.id ?? `mock-${store.size + 1}`;
      const next = { ...store.get(id), ...event, id, etag: `etag-${Date.now()}` };
      store.set(id, next);
      return next;
    },
    async deleteEvent({ eventId }) {
      store.delete(eventId);
    },
  };
}
