import { NextResponse } from "next/server";
import { assertActiveMembership } from "@/lib/household-context";
import { createHouseholdExportSignedUrl } from "@/lib/storage/signed-urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ householdId: string; jobId: string }> },
) {
  const { householdId, jobId } = await context.params;
  const ctx = await assertActiveMembership(householdId);
  if (!ctx.roles.includes("household_coordinator")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { createClient } = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  const { data: job } = await supabase
    .from("household_export_jobs")
    .select("storage_path, status, expires_at")
    .eq("id", jobId)
    .eq("household_id", householdId)
    .maybeSingle();

  if (!job || job.status !== "succeeded" || !job.storage_path) {
    return NextResponse.json({ error: "Export not ready" }, { status: 404 });
  }
  if (job.expires_at && new Date(job.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "Export expired" }, { status: 410 });
  }

  const url = await createHouseholdExportSignedUrl(job.storage_path);
  if (!url) {
    return NextResponse.json({ error: "Could not sign download" }, { status: 500 });
  }
  return NextResponse.redirect(url);
}
