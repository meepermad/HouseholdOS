import { redirect } from "next/navigation";
import { performClearHouseholdContext } from "@/lib/recovery-actions";
import { safeRecoveryDestination } from "@/lib/recovery";

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  const nextRaw = formData?.get("next");
  const next =
    typeof nextRaw === "string" ? safeRecoveryDestination(nextRaw) : null;

  const result = await performClearHouseholdContext("/auth/clear-household");
  redirect(next ?? result.redirectedTo);
}

export async function GET() {
  redirect("/recovery");
}
