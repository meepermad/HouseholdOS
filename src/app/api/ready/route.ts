import { NextResponse } from "next/server";
import { ConfigurationError, parsePublicEnv } from "@/lib/env/public";
import { parseServerEnv } from "@/lib/env/server-schema";

/** Readiness probe — configuration is valid. Does not use the secret key. */
export async function GET() {
  try {
    parsePublicEnv();
    parseServerEnv();
    return NextResponse.json({ status: "ready" });
  } catch (error) {
    const message =
      error instanceof ConfigurationError
        ? error.message
        : "Configuration is incomplete.";
    return NextResponse.json({ status: "not_ready", error: message }, { status: 503 });
  }
}
