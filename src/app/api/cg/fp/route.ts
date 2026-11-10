import { NextRequest, NextResponse } from "next/server";
import { loadFpBars } from "@/lib/cg/fp-load";
import { isAsset } from "@/lib/cg/assets";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/fp?sym=BTC&itv=m15&limit=300&oi=0[&live=1]
 *
 * EXACT port of the live footprint page's data loader (their `eM`) — see
 * src/lib/cg/fp-load.ts for the pipeline. The notification scanner runs the
 * identical function server-side, so the feed and the chart always agree.
 *
 * `live=1` is the fast lane for the FORMING bar: limit is clamped to ≤12
 * bars and the snapshot TTL drops to 8 s, so the client's 8-second poll
 * always gets a fresh tail while the heavy 300-bar history load keeps its
 * longer TTL. No synthetic data — every value comes from the Coinglass API.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sym = (sp.get("sym") ?? "BTC").toUpperCase();
  if (!isAsset(sym)) {
    return NextResponse.json({ ok: false, error: `unknown asset ${sym}` }, { status: 400 });
  }
  const itv = sp.get("itv") ?? "m15";
  const live = sp.get("live") === "1";
  const limit = live
    ? Math.min(Math.max(Number(sp.get("limit") ?? 8) || 8, 2), 12)
    : Math.min(Math.max(Number(sp.get("limit") ?? 300) || 300, 1), 1000);
  const withOi = sp.get("oi") === "1";
  try {
    const res = await loadFpBars(sym, itv, limit, withOi, live ? 8_000 : 45_000);
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "fetch failed" }, { status: 502 });
  }
}
