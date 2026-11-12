import { NextRequest, NextResponse } from "next/server";
import { loadFpBars } from "@/lib/cg/fp-load";
import { anyTerminalSym, knownSym } from "@/lib/cg/sym-gate";
import { markViewed } from "@/lib/cg/scan";
import { parseInterval } from "@/lib/cg/params";

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
 *
 * Curated perps are members since 2026-11-12, and the venue set is THE
 * COINGLASS AGGREGATED METHOD (agg-perp: Binance+OKX+Bybit+Hyperliquid,
 * fpVenues() in src/lib/cg/assets.ts — Hyperliquid price-shifted onto the
 * Binance lead kline), so the Footprint tab and its signals match the
 * Coinglass footprint page 1:1 (BTC/ETH parity: scripts/test-signal-parity.ts).
 * The live Binance forming overlay (useLiveForming) stays the real-time layer.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sym = (sp.get("sym") ?? "BTC").trim().toUpperCase();
  if (!(await anyTerminalSym(sym))) {
    return NextResponse.json({ ok: false, error: `unknown asset ${sym}` }, { status: 400 });
  }
  markViewed(sym); // priority continuity: keep the viewed asset on the hot scan lane
  // classic instruments (SPX500/NDX100/UKO) pass the terminal gate but have
  // no perp order flow anywhere — degrade honestly, never a dead 400/502.
  if (!(await knownSym(sym))) {
    return NextResponse.json({
      ok: true,
      supported: false,
      sym,
      reason: "Footprint requires perp order flow (unavailable for classic cash/CFD instruments)",
      updatedAt: Date.now(),
    });
  }
  const itv = parseInterval(sp.get("itv"));
  if (!itv) {
    return NextResponse.json({ ok: false, error: "invalid interval" }, { status: 400 });
  }
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
