import { NextResponse } from "next/server";
import { getQuotes, getUniverse } from "@/lib/binance/universe";

export const dynamic = "force-dynamic";

/**
 * GET /api/binance/quotes — REST fallback for the markets grid.
 *
 * One weight-10 bookTicker call covers the WHOLE universe (5s shared TTL),
 * so a browser that cannot hold the !miniTicker@arr WebSocket still gets
 * 5s-fresh bid/ask/last for all top-N assets. Primary tier is the browser
 * WS (1s push, zero server weight) — this route is the honest fallback.
 */
export async function GET() {
  await getUniverse(); // membership map must exist before quotes are filtered
  const q = await getQuotes();
  const ok = Object.keys(q.quotes).length > 0;
  return NextResponse.json({
    ok,
    at: q.at,
    ageMs: q.at ? Math.max(0, Date.now() - q.at) : null,
    quotes: q.quotes,
    ...(q.err ? { error: q.err } : {}),
    serverTime: Date.now(),
  });
}
