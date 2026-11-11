import { NextResponse } from "next/server";
import { getQuotes, getUniverse, binAssets } from "@/lib/binance/universe";
import { t24Of } from "@/lib/binance/market-batch";

export const dynamic = "force-dynamic";

/**
 * GET /api/binance/quotes — REST fallback for the markets grid.
 *
 * Tier 1: one weight-10 bookTicker call covers the WHOLE universe (5s shared
 * TTL) → bid/ask/last. Tier 2 (2026-11-12 fix): the shared all-symbol
 * ticker/24hr batch (weight 40, 4s TTL, already serving the market stats
 * block) enriches every quote with chg% · 24h high/low · 24h quote volume —
 * so a browser whose fstream socket connects-but-delivers-nothing (verified
 * on this egress: !miniTicker@arr frames filtered) still gets a FULLY
 * populated grid (last · chg · range · vol), not three dead columns.
 *
 * Primary tier remains the browser WS (1s push, zero server weight) — this
 * route is the honest fallback and the badge names the active tier.
 */
export async function GET() {
  const u = await getUniverse(); // membership map must exist before quotes are filtered
  const q = await getQuotes();
  const quotes = q.quotes;
  const ok = Object.keys(quotes).length > 0;

  // Enrich with 24h stats from the shared batch (one weight-40 fetch,
  // coalesced with every other consumer). Failure is soft: bid/ask/last
  // still return, chg/range just stay absent.
  if (ok) {
    const assets = binAssets();
    await Promise.allSettled(
      assets.map(async (a) => {
        const row = quotes[a.sym];
        if (!row) return;
        try {
          const t = await t24Of(a.pair);
          if (!t) return;
          const chgPct = Number(t.priceChangePercent);
          const high = Number(t.highPrice);
          const low = Number(t.lowPrice);
          const quoteVol = Number(t.quoteVolume);
          const lastT = Number(t.lastPrice);
          if (Number.isFinite(chgPct)) row.chgPct = chgPct;
          if (Number.isFinite(high) && high > 0) row.high = high;
          if (Number.isFinite(low) && low > 0) row.low = low;
          if (Number.isFinite(quoteVol) && quoteVol > 0) row.quoteVol = quoteVol;
          // ticker/24hr lastPrice is the true last trade (bookTicker mid is
          // an approximation) — prefer it when present
          if (Number.isFinite(lastT) && lastT > 0) row.last = lastT;
        } catch {
          /* enrichment is best-effort */
        }
      })
    );
  }

  return NextResponse.json({
    ok,
    at: q.at,
    ageMs: q.at ? Math.max(0, Date.now() - q.at) : null,
    quotes,
    ...(q.err ? { error: q.err } : {}),
    serverTime: Date.now(),
  });
}
