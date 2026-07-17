import { NextResponse } from "next/server";
import { getProductLookupAdapter, normalizeBarcode } from "@/lib/products/lookup";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const barcode = normalizeBarcode(url.searchParams.get("barcode") ?? "");
  if (barcode.length < 6) {
    return NextResponse.json({ error: "Invalid barcode" }, { status: 400 });
  }
  const adapter = getProductLookupAdapter();
  const result = await adapter.lookup(barcode);
  if (!result) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(result);
}
