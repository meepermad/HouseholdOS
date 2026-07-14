import { NextResponse } from "next/server";

/** Liveness probe — process is up. */
export async function GET() {
  return NextResponse.json({ status: "ok", service: "householdos" });
}
