/**
 * Market snapshot builder — the "Overview" data: current price, auction
 * levels (VAL/POC/VAH for session/day/month), Fib-prime EMA 13/89/233,
 * RSI(14) and day-anchored VWAP with ±1σ/2σ/3σ bands.
 *
 * Everything is computed from live Binance-perp klines fetched through the
 * Coinglass API (#kline) — no synthetic values. VWAP anchors at the UTC day
 * open, so it matches every exchange/TradingView convention regardless of
 * the viewer's local timezone (IST or UTC alike).
 */

import { cgGet } from "./client";
import type { KlineRow } from "./types";
import {
  auctionLevels,
  dayVwap,
  emaLast,
  rsiLast,
  utcDayStart,
  utcMonthStart,
  type AuctionSet,
  type VwapResult,
} from "./indicators";
import { assetOf, isAsset, leadInstr, symDecs, type AssetCfg } from "./assets";
import { hlCoinOf, resolveCgSym } from "../binance/aliases";
import { classicOf } from "./classic";
import { getUniverse, isBinanceSym } from "../binance/universe";
import { fetchBinCandles, fetchHlCandles, fetchYahooCandles, resolveClassicYahooTicker, type OHLCVCandle } from "./fallbacks";

export interface MarketSnapshot {
  ok: boolean;
  sym: string;
  name: string;
  kind: "crypto" | "metal" | "equity" | "commodity" | "index";
  source?: string;
  priceDecs?: number;
  price: {
    last: number | null;
    prevDayClose: number | null;
    chgDayPct: number | null;
    dayHigh: number | null;
    dayLow: number | null;
    dayVolBase: number | null;
  };
  auction: AuctionSet;
  ema: Record<string, { e13: number | null; e89: number | null; e233: number | null }>;
  rsi: Record<string, number | null>;
  vwap: VwapResult;
  anchorInfo: { dayStart: number; monthStart: number };
  updatedAt: number;
}

/** module cache: sym → {at, snap, err} */
const cache = new Map<string, { at: number; snap?: MarketSnapshot; err?: string }>();
const TTL = Number(process.env.CG_MARKET_TTL_MS ?? 12_000) || 12_000;

async function fetchKlines(instKey: string, itv: string, limit: number): Promise<KlineRow[]> {
  const r = (await cgGet(
    `/api/v2/kline?symbol=${encodeURIComponent(`${instKey}#kline`)}&interval=${itv}&minLimit=false&limit=${limit}`,
    90_000
  )) as { data?: KlineRow[] } | KlineRow[];
  const rows = Array.isArray(r) ? r : (r.data ?? []);
  return rows.filter((x) => x && Number.isFinite(+x[4]));
}

function toCandles(rows: KlineRow[]): OHLCVCandle[] {
  return rows.map((r) => ({ t: 1000 * Number(r[0]), o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +r[5] }));
}

function rollupCandles(bars: OHLCVCandle[], stepMs: number): OHLCVCandle[] {
  const buckets = new Map<number, OHLCVCandle>();
  for (const b of bars) {
    const k = Math.floor(b.t / stepMs) * stepMs;
    const prev = buckets.get(k);
    if (!prev) {
      buckets.set(k, { t: k, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v });
    } else {
      prev.h = Math.max(prev.h, b.h);
      prev.l = Math.min(prev.l, b.l);
      prev.c = b.c;
      prev.v += b.v;
    }
  }
  return [...buckets.values()].sort((a, b) => a.t - b.t);
}

export async function buildMarketSnapshot(symRaw: string): Promise<MarketSnapshot> {
  const sym = symRaw.trim().toUpperCase();
  const hit = cache.get(sym);
  if (hit && Date.now() - hit.at < TTL) {
    if (hit.snap) return hit.snap;
    throw hit.err ?? new Error("snapshot unavailable");
  }
  const cgSym = resolveCgSym(sym);
  const cfg: AssetCfg | undefined = assetOf(cgSym) ?? assetOf(sym);
  const classicCfg = classicOf(sym);
  await getUniverse();
  const hasBin = isAsset(cgSym) || isBinanceSym(cgSym) || !!classicCfg?.binPair;

  let m15: OHLCVCandle[] = [];
  let h1: OHLCVCandle[] = [];
  let h4: OHLCVCandle[] = [];
  let d1: OHLCVCandle[] = [];
  let source = "coinglass";

  // 1) Coinglass primary for any Binance-listed perpetual
  if (hasBin) {
    const lead = leadInstr(sym);
    try {
      const [m15Raw, h1Raw, h4Raw, d1Raw] = await Promise.all([
        fetchKlines(lead, "m15", 1000),
        fetchKlines(lead, "h1", 1000),
        fetchKlines(lead, "h4", 500),
        fetchKlines(lead, "d1", 500),
      ]);
      m15 = toCandles(m15Raw);
      h1 = toCandles(h1Raw);
      h4 = toCandles(h4Raw);
      d1 = toCandles(d1Raw);
    } catch {
      m15 = [];
    }
    // 2) Fallback directly to Binance USDT-M klines if Coinglass omits/rate-limits
    if (!m15.length) {
      try {
        [m15, h1, h4, d1] = await Promise.all([
          fetchBinCandles(sym, "m15", 1000),
          fetchBinCandles(sym, "h1", 1000),
          fetchBinCandles(sym, "h4", 500),
          fetchBinCandles(sym, "d1", 500),
        ]);
        if (m15.length) source = "binance-fapi";
      } catch {
        m15 = [];
      }
    }
  }

  // 3) Hyperliquid xyz fallback (indices: SPX500, NDX100, JP225, etc.)
  const hlCoin = hlCoinOf(sym);
  if (!m15.length && hlCoin) {
    try {
      [m15, h1, h4, d1] = await Promise.all([
        fetchHlCandles(hlCoin, "m15", 800),
        fetchHlCandles(hlCoin, "h1", 800),
        fetchHlCandles(hlCoin, "h4", 400),
        fetchHlCandles(hlCoin, "d1", 300),
      ]);
      if (m15.length) source = "hl-xyz";
    } catch {
      m15 = [];
    }
  }

  // 4) Yahoo Finance fallback for classic benchmarks without crypto rail (US30, VIX, GER30...)
  const yfInfo = resolveClassicYahooTicker(sym);
  if (!m15.length && yfInfo) {
    try {
      const [ym15, yh1, yd1] = await Promise.all([
        fetchYahooCandles(yfInfo.yahoo, "15m", "5d"),
        fetchYahooCandles(yfInfo.yahoo, "1h", "1mo"),
        fetchYahooCandles(yfInfo.yahoo, "1d", "2y"),
      ]);
      m15 = ym15;
      h1 = yh1.length ? yh1 : ym15;
      h4 = yh1.length ? rollupCandles(yh1, 4 * 3_600_000) : [];
      d1 = yd1;
      if (m15.length) source = "yahoo";
    } catch {
      m15 = [];
    }
  }

  if (!m15.length) throw new Error(`no klines for ${sym}`);
  const now = Date.now();
  const dayStart = utcDayStart(now);

  const last = m15[m15.length - 1];
  const prevDayBars = m15.filter((c) => c.t < dayStart);
  const prevDayClose = prevDayBars.length ? prevDayBars[prevDayBars.length - 1].c : null;
  const dayBars = m15.filter((c) => c.t >= dayStart);

  const closesOf = (arr: OHLCVCandle[]) => arr.map((c) => c.c);
  const emaSet = (arr: OHLCVCandle[]) => ({
    e13: emaLast(closesOf(arr), 13),
    e89: emaLast(closesOf(arr), 89),
    e233: emaLast(closesOf(arr), 233),
  });

  const snap: MarketSnapshot = {
    ok: true,
    sym,
    name: cfg?.name ?? classicCfg?.name ?? sym,
    kind: cfg?.kind ?? classicCfg?.klass ?? "crypto",
    source,
    priceDecs: symDecs(sym, last.c),
    price: {
      last: last.c,
      prevDayClose,
      chgDayPct: prevDayClose ? ((last.c - prevDayClose) / prevDayClose) * 100 : null,
      dayHigh: dayBars.length ? Math.max(...dayBars.map((c) => c.h)) : null,
      dayLow: dayBars.length ? Math.min(...dayBars.map((c) => c.l)) : null,
      dayVolBase: dayBars.reduce((s, c) => s + c.v, 0),
    },
    auction: auctionLevels(m15, h1.length ? h1 : m15, now),
    ema: {
      m15: emaSet(m15),
      h1: emaSet(h1),
      h4: emaSet(h4),
      d1: emaSet(d1),
    },
    rsi: {
      m15: rsiLast(closesOf(m15)),
      h1: rsiLast(closesOf(h1)),
      h4: rsiLast(closesOf(h4)),
      d1: rsiLast(closesOf(d1)),
    },
    vwap: dayVwap(m15, now),
    anchorInfo: { dayStart, monthStart: utcMonthStart(now) },
    updatedAt: Date.now(),
  };
  cache.set(sym, { at: Date.now(), snap });
  return snap;
}

export function marketCacheInfo() {
  return [...cache.entries()].map(([sym, e]) => ({ sym, ageMs: Date.now() - e.at, ok: !!e.snap }));
}
