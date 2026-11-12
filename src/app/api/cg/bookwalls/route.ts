import { NextRequest, NextResponse } from "next/server";
import { cgGet } from "@/lib/cg/client";
import {
  buildWallsModel,
  decodeRow,
  fetchAggregateWithDiscovery,
  minWallForSym,
  type BookSnapshot,
} from "@/lib/cg/book-walls";
import type { KlineRow } from "@/lib/cg/types";
import { aggVenues } from "@/lib/cg/assets";
import { anyTerminalSym, knownSym } from "@/lib/cg/sym-gate";
import { BoundedMap } from "@/lib/cg/bounded";
import { hlCoinOf, resolveBinPair, resolveCgSym } from "@/lib/binance/aliases";
import { binAssetOf, getUniverse } from "@/lib/binance/universe";
import { isClassic } from "@/lib/cg/classic";
import { fapiFetch } from "@/lib/live/fapi";
import { cleanGridStep, fetchHlCtxAndBook } from "@/lib/cg/fallbacks";

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
const NORMALIZE: Record<string, string> = { m1: "1m", m5: "5m", m15: "15m", h1: "1h", h4: "4h", d1: "1d" };

const cache = new BoundedMap<{ at: number; body: unknown }>(24);

function buildSnapFromBook(
  bids: [number, number][],
  asks: [number, number][],
  grid: number
): BookSnapshot | null {
  if (!bids.length || !asks.length || !(grid > 0)) return null;
  let bb = -Infinity;
  let ba = Infinity;
  for (const [p, q] of bids) if (q > 0 && p > bb) bb = p;
  for (const [p, q] of asks) if (q > 0 && p < ba) ba = p;
  if (!(bb > 0) || !Number.isFinite(ba) || ba <= bb) return null;
  let kMin = Infinity;
  let kMax = -Infinity;
  const flat: number[] = [];
  for (const [p, q] of bids) {
    if (!(q > 0) || p > bb) continue;
    const k = Math.round(p / grid);
    if (k < kMin) kMin = k;
    if (k > kMax) kMax = k;
    flat.push(k, q);
  }
  for (const [p, q] of asks) {
    if (!(q > 0) || p < ba) continue;
    const k = Math.round(p / grid);
    if (k < kMin) kMin = k;
    if (k > kMax) kMax = k;
    flat.push(k, q);
  }
  if (!flat.length || kMax - kMin + 1 > 200_000) return null;
  const arr = new Float64Array(kMax - kMin + 1);
  for (let i = 0; i < flat.length; i += 2) arr[flat[i] - kMin] += flat[i + 1];
  return { t: Date.now(), g: grid, k0: kMin, q: arr, bb, ba, mid: (bb + ba) / 2 };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sym = (sp.get("sym") ?? "BTC").trim().toUpperCase();
  if (!(await anyTerminalSym(sym))) {
    return NextResponse.json({ ok: false, error: `unknown asset ${sym}` }, { status: 400 });
  }
  const cgSym = resolveCgSym(sym);
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
  if (hit && Date.now() - hit.at < 18_000) return NextResponse.json(hit.body);

  const minUsd = minWallForSym(sym);
  await getUniverse();
  const hasPerp = await knownSym(sym);
  const isTradifi = !!isClassic(sym) || binAssetOf(cgSym)?.contractType === "TRADIFI_PERPETUAL";

  try {
    const candidates = aggVenues(sym, market);
    if (market === "spot" && (!candidates.length || isTradifi || !hasPerp)) {
      return NextResponse.json({
        ok: true,
        supported: false,
        sym,
        market,
        interval,
        limit,
        band,
        venues: [],
        minWallUsd: minUsd,
        reason: "No spot order-book heatmap upstream — perpetual futures contract only",
        model: null,
        updatedAt: Date.now(),
      });
    }

    // 1) Coinglass multi-venue aggregate stream when supported
    if (hasPerp && candidates.length) {
      try {
        const { venues, result: stream } = await fetchAggregateWithDiscovery({
          coin: cgSym,
          exchanges: candidates,
          market,
          interval: API_ITV[interval],
          limit,
          endTime,
        });
        if (stream.size > 0 && stream.rows.length) {
          const snapshots: BookSnapshot[] = [];
          for (const row of stream.rows) {
            const s = decodeRow(row, stream.size);
            if (s) snapshots.push(s);
          }
          snapshots.sort((a, b) => a.t - b.t);

          let candles: { ts: number; h: number; l: number }[] = [];
          try {
            const leadKey = market === "futures" ? `Binance_${cgSym}USDT` : `Binance_SPOT_${cgSym}USDT`;
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
            candles = [];
          }

          const model = buildWallsModel(snapshots, sym, band, candles, STEP_MS[interval]);
          if (model) {
            const body = {
              ok: true,
              supported: true,
              source: "coinglass",
              sym,
              market,
              interval,
              limit,
              band,
              venues,
              minWallUsd: minUsd,
              model,
              updatedAt: Date.now(),
            };
            cache.set(key, { at: Date.now(), body });
            return NextResponse.json(body);
          }
        }
      } catch {
        /* fallback gracefully below */
      }
    }

    // 2) Fallback: Direct Binance top-1000 depth snapshot
    if (hasPerp && market === "futures") {
      try {
        const pair = resolveBinPair(sym);
        const rawDepth = (await fapiFetch(`/fapi/v1/depth?symbol=${encodeURIComponent(pair)}&limit=1000`, 5_000)) as {
          bids?: [string, string][];
          asks?: [string, string][];
        };
        const bids = (rawDepth.bids ?? []).map(([p, q]): [number, number] => [Number(p), Number(q)]);
        const asks = (rawDepth.asks ?? []).map(([p, q]): [number, number] => [Number(p), Number(q)]);
        const mid = bids.length && asks.length ? (bids[0][0] + asks[0][0]) / 2 : 0;
        const snap = buildSnapFromBook(bids, asks, cleanGridStep(mid));
        const model = snap ? buildWallsModel([snap], sym, band, [], STEP_MS[interval]) : null;
        if (model) {
          const body = {
            ok: true,
            supported: true,
            source: "binance-fapi",
            sym,
            market,
            interval,
            limit,
            band,
            venues: [`Binance ${pair} (live depth)`],
            minWallUsd: minUsd,
            model,
            updatedAt: Date.now(),
          };
          cache.set(key, { at: Date.now(), body });
          return NextResponse.json(body);
        }
      } catch {
        /* try HL xyz */
      }
    }

    // 3) Fallback: Hyperliquid xyz 20-level L2 book (SPX500, NDX100, JP225)
    if (market === "futures" && hlCoinOf(sym)) {
      const hl = await fetchHlCtxAndBook(sym).catch(() => null);
      if (hl?.book?.bids.length && hl.book.asks.length) {
        const bids = hl.book.bids.map((l): [number, number] => [l.px, l.sz]);
        const asks = hl.book.asks.map((l): [number, number] => [l.px, l.sz]);
        const mid = (bids[0][0] + asks[0][0]) / 2;
        const snap = buildSnapFromBook(bids, asks, cleanGridStep(mid));
        const model = snap ? buildWallsModel([snap], sym, band, [], STEP_MS[interval]) : null;
        if (model) {
          const body = {
            ok: true,
            supported: true,
            source: "hl-xyz",
            sym,
            market,
            interval,
            limit,
            band,
            venues: [`Hyperliquid ${hl.coin} (20-lvl L2)`],
            minWallUsd: minUsd,
            model,
            updatedAt: Date.now(),
          };
          cache.set(key, { at: Date.now(), body });
          return NextResponse.json(body);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      supported: false,
      sym,
      market,
      interval,
      limit,
      band,
      venues: [],
      minWallUsd: minUsd,
      reason: "Order-book heatmap unavailable for this cash/CFD benchmark",
      model: null,
      updatedAt: Date.now(),
    });
  } catch (e) {
    const stale = cache.get(key);
    if (stale) return NextResponse.json(stale.body);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "fetch failed" },
      { status: 502 }
    );
  }
}
