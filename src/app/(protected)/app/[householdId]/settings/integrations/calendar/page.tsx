import Link from "next/link";
import { assertActiveMembership } from "@/lib/household-context";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { AppBackButton } from "@/components/app-back-button";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  enqueueCalendarSyncAction,
  revokeGoogleCalendarConnectionAction,
  startGoogleCalendarOAuthAction,
} from "@/app/actions/calendar";
import { CalendarIcsImportPanel } from "@/components/calendar/CalendarIcsImportPanel";
import { GoogleConnectButton } from "@/components/calendar/GoogleConnectButton";
import { LIFEOS_CALENDAR_CONTRACT_VERSION } from "@/lib/calendar/lifeos-contract";

export const dynamic = "force-dynamic";

export default async function CalendarIntegrationsSettingsPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const ctx = await assertActiveMembership(householdId);
  const canManage = can(ctx.roles, "calendar.manage_integrations");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  const { data: connections } = canManage
    ? await supabase
        .from("calendar_external_connections")
        .select(
          "id, provider, account_email, sync_mode, status, last_sync_at, last_error_message",
        )
        .eq("household_id", householdId)
        .eq("owner_user_id", ctx.userId)
        .order("created_at", { ascending: false })
    : { data: [] };

  const { data: syncRuns } = canManage
    ? await supabase
        .from("calendar_sync_runs")
        .select("id, status, trigger_kind, created_at, finished_at, error_summary")
        .eq("household_id", householdId)
        .order("created_at", { ascending: false })
        .limit(8)
    : { data: [] };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <AppBackButton fallbackHref={`/app/${householdId}/settings`} />
      <header className="space-y-1">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">
          Calendar integrations
        </h1>
        <p className="text-sm text-text-secondary">
          Connect Google (OAuth), import ICS files, and authorize LifeOS read
          feeds. External connections are owned by you — coordinators cannot
          access your tokens.
        </p>
      </header>

      {!canManage ? (
        <p className="text-sm text-text-secondary">
          You do not have permission to manage calendar integrations.
        </p>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Google Calendar</h2>
            <p className="text-sm text-text-secondary">
              Minimum scopes · refresh tokens encrypted at rest · two-way sync
              is opt-in for native HouseholdOS events only. Live account
              verification requires deployment credentials.
            </p>
            <GoogleConnectButton householdId={householdId} />
            <ul className="space-y-2">
              {((connections ?? []) as Array<Record<string, string | null>>)
                .filter((c) => c.provider === "google")
                .map((c) => (
                  <li
                    key={c.id!}
                    className="rounded-md border border-border px-3 py-2 text-sm space-y-2"
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <span>
                        {c.account_email ?? "Google account"} · {c.status} ·{" "}
                        {c.sync_mode}
                      </span>
                      {c.last_error_message ? (
                        <span className="text-amber-700 dark:text-amber-400">
                          {c.last_error_message}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <ActionForm action={enqueueCalendarSyncAction}>
                        <input type="hidden" name="householdId" value={householdId} />
                        <input type="hidden" name="connectionId" value={c.id!} />
                        <SubmitButton className="min-h-11 rounded-md border border-border px-3 text-sm">
                          Sync now
                        </SubmitButton>
                      </ActionForm>
                      <ActionForm action={revokeGoogleCalendarConnectionAction}>
                        <input type="hidden" name="householdId" value={householdId} />
                        <input type="hidden" name="connectionId" value={c.id!} />
                        <SubmitButton className="min-h-11 rounded-md border border-border px-3 text-sm">
                          Revoke
                        </SubmitButton>
                      </ActionForm>
                    </div>
                  </li>
                ))}
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">ICS import</h2>
            <CalendarIcsImportPanel householdId={householdId} />
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">LifeOS</h2>
            <p className="text-sm text-text-secondary">
              Contract version {LIFEOS_CALENDAR_CONTRACT_VERSION}. Create a
              LifeOS-purpose feed under{" "}
              <Link
                href={`/app/${householdId}/settings/calendar`}
                className="text-primary underline-offset-2 hover:underline"
              >
                Calendar settings
              </Link>
              . Read-only · revocable · never service-role. See{" "}
              <code className="text-xs">docs/CALENDAR_LIFEOS.md</code>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Recent sync runs</h2>
            {(syncRuns ?? []).length === 0 ? (
              <p className="text-sm text-text-secondary">No sync runs yet.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {((syncRuns ?? []) as Array<Record<string, string | null>>).map(
                  (r) => (
                    <li key={r.id!} className="tabular-nums text-text-secondary">
                      {r.created_at} · {r.trigger_kind} · {r.status}
                      {r.error_summary ? ` — ${r.error_summary}` : ""}
                    </li>
                  ),
                )}
              </ul>
            )}
          </section>
        </>
      )}
      {/* keep action import referenced for tree */}
      <span className="hidden">{String(!!startGoogleCalendarOAuthAction)}</span>
    </div>
  );
}
