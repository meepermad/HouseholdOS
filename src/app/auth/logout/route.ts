import { redirect } from "next/navigation";
import { performEmergencyLogout } from "@/lib/recovery-actions";

export async function POST() {
  await performEmergencyLogout("/auth/logout");
  redirect("/login?reason=signed_out");
}

/** Reject state-changing GET to avoid CSRF via prefetch/link. */
export async function GET() {
  redirect("/recovery");
}
