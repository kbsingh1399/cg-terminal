import { NextRequest, NextResponse } from "next/server";
import { cgGet } from "@/lib/cg/client";
import {
  buildWallsModel,
  decodeRow,
  fetchAggregateWithDiscovery,
  WALL_MIN_USD,
  type BookSnapshot,
} from "@/lib/cg/book-walls";
import type { KlineRow } from "@/lib/cg/types";
import { aggVenues } from "@/lib/cg/assets";
import { knownSym, gateReject } from "@/lib/cg/sym-gate";
import { BoundedMap } from "@/lib/cg/bounded";

export const dynamic = "force-dynamic";

/**
 * GET /api/cg/bookwalls?sym=BTC&market=futures|spot&interval=m15&limit=150&band=5
 *
 * Order-book walls + depth KPIs — the aggregate mode of the Coinglass
 * /LiquidityHeatmap page: bid/ask depth within ±band%, imbalance (now and
 * 5 minutes ago), largest bid/ask wall, the live wall list within ±3% and
 * the add/fill/pull event feed — computed with their exact wall scanner
 * (src/lib/cg/book-walls.ts).
 *
 * Pure API data: NDJSON aggregate stream
 * /liquidity-heatmap/api/liquidity/heatmap/aggregate/stream (server-side
 * venue merge, price-shift aligned) + /api/v2/kline for the candle path.
 *
 * Curated perps (crypto + TradFi) are members since 2026-11-12: the venue
 * set per (coin, market) is DISCOVERED live (the stream names any venue
 * without a pair; discovery drops it and retries, cached 1h) — every coin
 * aggregates over exactly the exchanges that carry its book.
 */

const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
const API_ITV: Record<string, string> = { "1m": "m1", "5m": "m5", "15m": "m15", "1h": "h1", "4h": "h4", "1d": "d1" };
const STEP_MS: Record<string, number> = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "1h": 3_600_000,
  "4h": 14_400_000,
  "1d": 86_400_000,
};
/** accept both "m15" (app convention) and "15m" (page convention) */
const NORMALIZE: Record<string, string> = { m1: "1m", m5: "5m", m15: "15m", h1: "1h", h4: "4h", d1: "1d" };

/** module-level cache per (sym, market, interval, limit, band, endTime) — streams
 *  are heavy. BOUNDED: a varying query param must never grow server memory. */
const cache = new BoundedMap<{ at: number; body: unknown }>(24);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sym = (sp.get("sym") ?? "BTC").toUpperCase();
  if (!(await knownSym(sym))) {
    return NextResponse.json({ ok: false, error: gateReject(sym) }, { status: 400 });
  }
  const market = sp.get("market") === "spot" ? "spot" : "futures";
  const rawItv = sp.get("interval") ?? "m15";
  const interval = INTERVALS.includes(rawItv as (typeof INTERVALS)[number])
    ? rawItv
    : (NORMALIZE[rawItv] ?? "15m");
  const limit = Math.min(Math.max(Number(sp.get("limit") ?? 150) || 150, 30), 300);
  const band = [0.5, 1, 2, 5].includes(Number(sp.get("band"))) ? Number(sp.get("band")) : 5;
  const endTimeRaw = Number(sp.get("endTime") ?? 0);
  if (Number.isFinite(endTimeRaw) && endTimeRaw !== 0 && !(endTimeRaw > 0)) {
    return NextResponse.json({ ok: false, error: "endTime must be a positive unix-seconds value" }, { status: 400 });
  }
  // history windows only: heatmap history reaches back ~30 days on the
  // anonymous API — reject anything outside it (also keeps the cache key
  // from being used as a memory-growth primitive)
  const MAX_LOOKBACK_S = 30 * 86_400;
  let endTime: number | undefined;
  if (Number.isFinite(endTimeRaw) && endTimeRaw > 0) {
    const nowS = Math.floor(Date.now() / 1000);
    if (endTimeRaw > nowS + 300 || endTimeRaw < nowS - MAX_LOOKBACK_S) {
      return NextResponse.json({ ok: false, error: `endTime out of range (max ${MAX_LOOKBACK_S / 86_400} days back)` }, { status: 400 });
    }
    endTime = Math.floor(endTimeRaw);
  }

  const key = `${sym}|${market}|${interval}|${limit}|${band}|${endTime ?? "now"}`;
  const hit = cache.get(key);
  // 18s: the aggregate resync cadence — the client polls every 15s and the
  // REAL-TIME layer (WS price + /api/cg/livebook) covers the gap between
  if (hit && Date.now() - hit.at < 18_000) return NextResponse.json(hit.body);

  try {
    // per-coin venue discovery: the stream itself names any venue without a
    // (coin, market) heatmap pair — discovery drops it, retries and caches
    // the winning set (1h). BTC/ETH keep their curated full lists.
    const candidates = aggVenues(sym, market);
    if (!candidates.length) {
      return NextResponse.json(
        { ok: false, error: `no ${market} aggregate for ${sym} on the liquidity-heatmap stream — use market=futures` },
        { status: 400 }
      );
    }
    const { venues, result: stream } = await fetchAggregateWithDiscovery({
      coin: sym,
      exchanges: candidates,
      market,
      interval: API_ITV[interval],
      limit,
      endTime,
    });
    if (!(stream.size > 0) || !stream.rows.length) {
      return NextResponse.json(
        { ok: false, error: "aggregate stream returned no rows (retrying next poll)" },
        { status: 502 }
      );
    }

    const snapshots: BookSnapshot[] = [];
    for (const row of stream.rows) {
      const s = decodeRow(row, stream.size);
      if (s) snapshots.push(s);
    }
    snapshots.sort((a, b) => a.t - b.t);

    // candle path from the lead venue for wall touch detection
    let candles: { ts: number; h: number; l: number }[] = [];
    try {
      const leadKey = market === "futures" ? `Binance_${sym}USDT` : `Binance_SPOT_${sym}USDT`;
      const kl = (await cgGet(
        `/api/v2/kline?symbol=${encodeURIComponent(leadKey + "#kline")}&interval=${API_ITV[interval]}&limit=${Math.min(
          limit + 2,
          302
        )}${endTime ? `&endTime=${endTime + 1}` : ""}`,
        60_000
      )) as { data?: KlineRow[] } | KlineRow[];
      const klRows = Array.isArray(kl) ? kl : (kl.data ?? []);
      candles = klRows
        .map((r) => ({ ts: 1000 * Number(r[0]), h: Number(r[2]), l: Number(r[3]) }))
        .filter((c) => Number.isFinite(c.h));
    } catch {
      /* wall touch falls back to book-only range */
    }

    const model = buildWallsModel(snapshots, sym, band, candles, STEP_MS[interval]);
    if (!model) {
      return NextResponse.json({ ok: false, error: "no decodable snapshots" }, { status: 502 });
    }

    const body = {
      ok: true,
      sym,
      market,
      interval,
      limit,
      band,
      venues,
      minWallUsd: WALL_MIN_USD[sym] ?? 100_000,
      model,
      updatedAt: Date.now(),
    };
    cache.set(key, { at: Date.now(), body });
    return NextResponse.json(body);
  } catch (e) {
    const stale = cache.get(key);
    if (stale) return NextResponse.json(stale.body);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "fetch failed" },
      { status: 502 }
    );
  }
}
