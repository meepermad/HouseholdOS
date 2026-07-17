/**
 * Calendar interoperability status helpers (Completion-H).
 * Google: PKCE + sealed tokens exist; live two-way requires GOOGLE_CLIENT_* credentials.
 * Apple: ICS subscribe/export/import only — no iCloud credentials or native writeback.
 */

export type CalendarInteropMode =
  | "google_mock"
  | "google_live"
  | "apple_ics_subscribe"
  | "apple_ics_export"
  | "apple_ics_import";

export function googleCalendarMode(env: {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}): "google_live" | "google_mock" {
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) return "google_live";
  return "google_mock";
}

export function appleCalendarCapabilities(): CalendarInteropMode[] {
  return ["apple_ics_subscribe", "apple_ics_export", "apple_ics_import"];
}

export function describeCalendarInterop(env: {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}): string {
  const google = googleCalendarMode(env);
  return google === "google_live"
    ? "Google live OAuth available; Apple remains ICS-only (no iCloud writeback)."
    : "Google uses mock provider until OAuth credentials are configured; Apple remains ICS-only.";
}
