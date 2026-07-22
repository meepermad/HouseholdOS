import { NextResponse } from "next/server";
import { getInvitationOriginReadiness } from "@/lib/env/canonical-origin";
import { ConfigurationError, parsePublicEnv } from "@/lib/env/public";
import { parseServerEnv } from "@/lib/env/server-schema";

/** Readiness probe — configuration is valid. Does not use the secret key. */
export async function GET() {
  const invitationOrigin = getInvitationOriginReadiness();
  try {
    parsePublicEnv();
    parseServerEnv();
    return NextResponse.json({
      status: "ready",
      invitation_origin_configured: invitationOrigin.invitation_origin_configured,
      invitation_origin_host: invitationOrigin.invitation_origin_host,
      invitation_origin_https: invitationOrigin.invitation_origin_https,
    });
  } catch (error) {
    const message =
      error instanceof ConfigurationError
        ? error.message
        : "Configuration is incomplete.";
    return NextResponse.json(
      {
        status: "not_ready",
        error: message,
        invitation_origin_configured: invitationOrigin.invitation_origin_configured,
        invitation_origin_host: invitationOrigin.invitation_origin_host,
        invitation_origin_https: invitationOrigin.invitation_origin_https,
      },
      { status: 503 },
    );
  }
}
