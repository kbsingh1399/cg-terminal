import { NextRequest, NextResponse } from "next/server";
import { loadFpBars } from "@/lib/cg/fp-load";
import { isAsset } from "@/lib/cg/assets";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/fp?sym=BTC&itv=m15&limit=300&oi=0
 *
 * EXACT port of the live footprint page's data loader (their `eM`) — see
 * src/lib/cg/fp-load.ts for the pipeline. The notification scanner runs the
 * identical function server-side, so the feed and the chart always agree.
 *
 * No synthetic data — every value comes from the Coinglass API.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sym = (sp.get("sym") ?? "BTC").toUpperCase();
  if (!isAsset(sym)) {
    return NextResponse.json({ ok: false, error: `unknown asset ${sym}` }, { status: 400 });
  }
  const itv = sp.get("itv") ?? "m15";
  const limit = Math.min(Math.max(Number(sp.get("limit") ?? 300) || 300, 1), 1000);
  const withOi = sp.get("oi") === "1";
  try {
    const res = await loadFpBars(sym, itv, limit, withOi);
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "fetch failed" }, { status: 502 });
  }
}
