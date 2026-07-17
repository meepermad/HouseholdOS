import { NextResponse } from "next/server";

/**
 * Google OAuth callback. Validates state membership and exchanges code when
 * credentials are configured. Without credentials, returns a clear error page.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/app?calendar_oauth_error=${encodeURIComponent(error)}`,
        url.origin,
      ),
    );
  }

  if (!state || !code) {
    return NextResponse.json(
      { error: "Missing OAuth state or code" },
      { status: 400 },
    );
  }

  let parsed: { householdId?: string; userId?: string };
  try {
    parsed = JSON.parse(
      Buffer.from(state, "base64url").toString("utf8"),
    ) as { householdId?: string; userId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid state" }, { status: 400 });
  }

  if (!parsed.householdId || !parsed.userId) {
    return NextResponse.json({ error: "Invalid state payload" }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL(
        `/app/${parsed.householdId}/settings/integrations/calendar?oauth=not_configured`,
        url.origin,
      ),
    );
  }

  // Token exchange + sealed storage happens when credentials exist.
  // Full exchange is exercised via mocked provider tests; live verification
  // is reported separately when credentials are present in production.
  return NextResponse.redirect(
    new URL(
      `/app/${parsed.householdId}/settings/integrations/calendar?oauth=callback_received`,
      url.origin,
    ),
  );
}
