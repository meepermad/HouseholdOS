import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProductLookupAdapter, normalizeBarcode } from "@/lib/products/lookup";

const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimit(key: string, limit = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const row = hits.get(key);
  if (!row || row.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (row.count >= limit) return false;
  row.count += 1;
  return true;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const barcode = normalizeBarcode(url.searchParams.get("barcode") ?? "");
  const householdId = String(url.searchParams.get("householdId") ?? "");
  if (barcode.length < 6) {
    return NextResponse.json({ error: "Invalid barcode" }, { status: 400 });
  }
  if (householdId) {
    const { data: membership } = await supabase
      .from("household_memberships")
      .select("id")
      .eq("household_id", householdId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (!rateLimit(`${user.id}:${householdId || "none"}`)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  if (
    process.env.APP_ENV === "production" &&
    (process.env.PRODUCT_LOOKUP_ADAPTER ?? "fixture") === "fixture"
  ) {
    return NextResponse.json(
      {
        barcode,
        name: null,
        brand: null,
        source: "manual",
        requiresReview: true,
        note: "Product lookup provider is not configured. Enter details manually.",
      },
      { status: 200 },
    );
  }

  const adapter = getProductLookupAdapter();
  const result = await adapter.lookup(barcode);
  if (!result) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(result);
}
