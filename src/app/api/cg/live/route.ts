import { NextRequest, NextResponse } from "next/server";
import { isAsset } from "@/lib/cg/assets";
import { getLivePrice, TTL } from "@/lib/live/server-price";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/live?sym=BTC — fast-fallback REST price.
 *
 * Primary live price is the browser WebSocket (fstream.binance.com
 * bookTicker, real-time). This route is tier 1 of the ladder for clients
 * whose browser cannot hold the WS (geo-block, strict proxies): the SERVER
 * polls Binance USDT-M futures bookTicker — the exact instrument
 * (Binance_<SYM>USDT perp) that leads every Coinglass aggregate in this
 * terminal — with a 250 ms shared TTL, so every tab/agent sees the same
 * sub-second price without hammering upstream (weight 2 per refresh).
 *
 * Tier 2 fallback: Coinglass m1 forming-candle close (the old /api/cg/ticker
 * source). The response always names its source — no silent mixing.
 *
 * The cache lives in src/lib/live/server-price.ts so the scanner lanes
 * (liq clusters, whale walls) anchor to the very same price.
 */

export async function GET(req: NextRequest) {
  const sym = (req.nextUrl.searchParams.get("sym") ?? "BTC").toUpperCase();
  if (!isAsset(sym)) {
    return NextResponse.json({ ok: false, error: `unknown asset ${sym}` }, { status: 400 });
  }
  const e = await getLivePrice(sym);
  const ok = e.price != null;
  return NextResponse.json({
    ok,
    sym,
    price: e.price,
    bid: e.bid,
    ask: e.ask,
    source: e.source,
    fetchedAt: e.at,
    ageMs: Math.max(0, Date.now() - e.at),
    stale: !ok,
    ...(e.fapiErr ? { fapiErr: e.fapiErr } : {}),
    ...(e.err ? { error: e.err } : {}),
    ttlMs: TTL,
  });
}
