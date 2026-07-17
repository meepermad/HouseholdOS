import { assertActiveMembership } from "@/lib/household-context";
import { AppBackButton } from "@/components/app-back-button";
import { ActionForm } from "@/components/action-form";
import { requestHouseholdExportAction } from "@/app/actions/export";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedDb = any;

export default async function ExportSettingsPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const ctx = await assertActiveMembership(householdId);
  const isCoordinator = ctx.roles.includes("household_coordinator");
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = (await createClient()) as UntypedDb;
  const { data: jobs } = await supabase
    .from("household_export_jobs")
    .select("id, status, created_at, completed_at, expires_at, error_text")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <main className="space-y-6" data-testid="export-settings">
      <AppBackButton fallbackHref={`/app/${householdId}/settings`} />
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-text-primary">
          Export household
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Coordinator backup archive (JSON + CSV tables). This is not a full
          database restore. Secrets, push subscriptions, and feed tokens are
          excluded.
        </p>
      </header>

      {isCoordinator ? (
        <ActionForm action={requestHouseholdExportAction}>
          <input type="hidden" name="householdId" value={householdId} />
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
            data-testid="export-request"
          >
            Request export
          </button>
        </ActionForm>
      ) : (
        <p className="text-sm text-text-secondary">
          Only household coordinators can request exports.
        </p>
      )}

      <ul className="divide-y divide-border rounded-md border border-border bg-surface text-sm">
        {(jobs ?? []).map(
          (j: {
            id: string;
            status: string;
            created_at: string;
            expires_at: string | null;
            error_text: string | null;
          }) => (
            <li key={j.id} className="flex items-center justify-between px-4 py-3">
              <span>
                {j.status} · {new Date(j.created_at).toLocaleString()}
                {j.error_text ? ` — ${j.error_text}` : ""}
              </span>
              {j.status === "succeeded" ? (
                <a
                  className="underline"
                  href={`/api/household/${householdId}/exports/${j.id}/download`}
                >
                  Download
                </a>
              ) : null}
            </li>
          ),
        )}
      </ul>
    </main>
  );
}
