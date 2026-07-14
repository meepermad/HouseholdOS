import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/navigation";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"), "/app");
  const errorDescription = searchParams.get("error_description");
  const errorCode = searchParams.get("error");

  if (errorCode || errorDescription) {
    const message = encodeURIComponent(
      errorDescription?.includes("expired")
        ? "This link has expired. Request a new one."
        : "This authentication link is invalid or has already been used.",
    );
    return NextResponse.redirect(`${origin}/login?error=${message}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const message = encodeURIComponent(
        "Unable to complete authentication. Request a new link.",
      );
      return NextResponse.redirect(`${origin}/login?error=${message}`);
    }
    await supabase.rpc("ensure_profile");
    return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login`);
}
